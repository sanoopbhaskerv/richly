import type { Editor } from '../../editor/Editor';
import { icons } from '../icons';
import { closeToolbarDropdowns, repositionToolbarDropdowns } from './ToolbarDropdowns';
import type { ToolbarLayoutServices } from './ToolbarModel';

let slidingDrawerId = 0;
const SLIDING_ANIMATION_SETTLE_MS = 300;

/**
 * Inline progressive-disclosure strategy for responsive toolbars.
 *
 * The leading section always remains visible. Trailing sections move into an
 * in-flow drawer, preserving DOM nodes, event handlers, selection bookmarks,
 * and any open child panel across responsive redistribution.
 */
export class SlidingToolbar {
  readonly toggleButton: HTMLButtonElement;

  private readonly primary: HTMLElement;
  private readonly toggleWrap: HTMLElement;
  private readonly drawer: HTMLElement;
  private readonly content: HTMLElement;
  private open = false;
  private openRequested = false;
  private overflowTimer: number | null = null;

  constructor(
    editor: Editor,
    private readonly container: HTMLElement,
    private readonly sections: HTMLElement[][],
    private readonly layout: ToolbarLayoutServices
  ) {
    const doc = container.ownerDocument;
    const view = doc.defaultView;
    container.classList.add('rly-toolbar-sliding-enabled');

    this.primary = doc.createElement('div');
    this.primary.className = 'rly-toolbar-primary';
    this.primary.dataset.testid = 'toolbar-primary';
    this.primary.append(...Array.from(container.children));

    this.toggleWrap = doc.createElement('div');
    this.toggleWrap.className = 'rly-toolbar-sliding-toggle';
    this.toggleWrap.hidden = true;

    this.toggleButton = doc.createElement('button');
    this.toggleButton.type = 'button';
    this.toggleButton.className = 'rly-tb-btn';
    this.toggleButton.dataset.testid = 'tb-more';
    this.toggleButton.dataset.tooltip = 'Show more tools';
    this.toggleButton.innerHTML = icons.more ?? '•••';
    this.toggleButton.setAttribute('aria-label', 'Show more tools');
    this.toggleButton.setAttribute('aria-expanded', 'false');
    this.toggleButton.addEventListener('mousedown', (event) => event.preventDefault());

    this.drawer = doc.createElement('div');
    this.drawer.id = `rly-toolbar-drawer-${++slidingDrawerId}`;
    this.drawer.className = 'rly-toolbar-sliding-drawer';
    this.drawer.dataset.testid = 'toolbar-sliding-drawer';
    this.drawer.setAttribute('role', 'group');
    this.drawer.setAttribute('aria-label', 'Additional editor tools');
    this.drawer.setAttribute('aria-hidden', 'true');
    this.toggleButton.setAttribute('aria-controls', this.drawer.id);

    this.content = doc.createElement('div');
    this.content.className = 'rly-toolbar-sliding-content';
    this.content.dataset.testid = 'toolbar-sliding-content';
    this.drawer.appendChild(this.content);
    this.toggleWrap.appendChild(this.toggleButton);
    this.primary.appendChild(this.toggleWrap);
    container.append(this.primary, this.drawer);

    this.toggleButton.addEventListener('click', (event) => {
      event.stopPropagation();
      this.openRequested = !this.open;
      this.setOpen(this.openRequested);
    });

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || !this.open || event.defaultPrevented) return;
      event.preventDefault();
      event.stopPropagation();
      this.openRequested = false;
      this.setOpen(false, true);
    };
    container.addEventListener('keydown', onKeyDown);

    let lastWidth = Number.NaN;
    let refreshFrame: number | null = null;
    let pendingForce = false;
    let destroyed = false;
    const refresh = (force = false): void => {
      // React StrictMode mounts, destroys, and mounts again in development.
      // Ignore measurements queued by a destroyed editor instance.
      if (destroyed || !container.isConnected) return;
      const width = this.layout.availableWidth();
      // Connected editors can be temporarily hidden while a grid resolves.
      if (width <= 0 || (!force && width === lastWidth)) return;
      // Measure once before moving groups; redistribution can temporarily alter
      // intrinsic grid sizing and must not change the width for this pass.
      this.refresh(width);
      lastWidth = width;
    };
    const scheduleRefresh = (force = false): void => {
      if (destroyed) return;
      pendingForce ||= force;
      if (refreshFrame !== null) return;

      const run = (): void => {
        refreshFrame = null;
        if (destroyed) return;
        const shouldForce = pendingForce;
        pendingForce = false;
        refresh(shouldForce);
      };

      if (view?.requestAnimationFrame) {
        // The sentinel supports synchronous rAF mocks without leaving the
        // scheduler permanently marked as pending after `run` completes.
        refreshFrame = -1;
        const frame = view.requestAnimationFrame(run);
        if (refreshFrame !== null) refreshFrame = frame;
      } else {
        refreshFrame = -1;
        queueMicrotask(run);
      }
    };

    const observer = view?.ResizeObserver ? new view.ResizeObserver(() => scheduleRefresh()) : null;
    for (const boundary of layout.widthBoundaries()) observer?.observe(boundary);
    const onResize = (): void => scheduleRefresh();
    const onLoad = (): void => scheduleRefresh(true);
    view?.addEventListener('resize', onResize);
    if (doc.readyState === 'loading') view?.addEventListener('load', onLoad, { once: true });
    void doc.fonts?.ready.then(() => scheduleRefresh(true));
    editor.events.on('destroy', () => {
      destroyed = true;
      observer?.disconnect();
      view?.removeEventListener('resize', onResize);
      view?.removeEventListener('load', onLoad);
      container.removeEventListener('keydown', onKeyDown);
      if (refreshFrame !== null && refreshFrame >= 0) view?.cancelAnimationFrame(refreshFrame);
      refreshFrame = null;
      if (this.overflowTimer !== null) {
        view?.clearTimeout(this.overflowTimer);
        this.overflowTimer = null;
      }
    });

    // Avoid a visible wrapped frame, then remeasure after fonts and sub-pixel
    // layout settle in a browser.
    refresh(true);
    scheduleRefresh(true);
  }

  /** Redistribute complete sections against one stable available-width value. */
  private refresh(availableWidth: number): void {
    // Preserve the user's disclosure choice when a transient measurement makes
    // the drawer unnecessary; a settled pass can reopen it with child state.
    const keepOpen = this.openRequested;
    for (const section of this.sections) {
      for (const item of section) this.primary.insertBefore(item, this.toggleWrap);
    }
    this.content.replaceChildren();
    this.toggleWrap.hidden = true;

    let occupiedWidth = this.layout.occupiedWidth(this.primary);
    if (availableWidth <= 0 || occupiedWidth <= availableWidth) {
      this.setOpen(false, false, true);
      repositionToolbarDropdowns(this.container, this.container.ownerDocument);
      return;
    }

    this.toggleWrap.hidden = false;
    // The first section contains the highest-priority controls and remains in
    // the primary row even when the host is exceptionally narrow.
    for (let index = this.sections.length - 1; index > 0; index--) {
      if (occupiedWidth <= availableWidth) break;
      this.content.prepend(...this.sections[index]!);
      occupiedWidth = this.layout.occupiedWidth(this.primary);
    }

    if (this.content.childElementCount === 0) {
      this.toggleWrap.hidden = true;
      this.setOpen(false, false, true);
      return;
    }
    this.setOpen(keepOpen);
    repositionToolbarDropdowns(this.container, this.container.ownerDocument);
  }

  /** Synchronize disclosure state, animation overflow, focus, and child panels. */
  private setOpen(open: boolean, focusToggle = false, preserveDropdowns = false): void {
    const changed = this.open !== open;
    this.open = open;
    this.drawer.classList.toggle('rly-open', open);
    this.drawer.setAttribute('aria-hidden', String(!open));
    this.toggleButton.setAttribute('aria-expanded', String(open));
    this.toggleButton.setAttribute('aria-label', open ? 'Hide more tools' : 'Show more tools');
    this.toggleButton.dataset.tooltip = open ? 'Hide more tools' : 'Show more tools';

    if (changed) {
      const view = this.container.ownerDocument.defaultView;
      if (this.overflowTimer !== null) {
        view?.clearTimeout(this.overflowTimer);
        this.overflowTimer = null;
      }
      this.drawer.classList.remove('rly-expanded');
      if (open) {
        if (view?.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
          this.drawer.classList.add('rly-expanded');
        } else if (view) {
          this.overflowTimer = view.setTimeout(() => {
            this.overflowTimer = null;
            if (this.open) this.drawer.classList.add('rly-expanded');
          }, SLIDING_ANIMATION_SETTLE_MS);
        }
      }
    }

    if (!open && changed) {
      if (!preserveDropdowns) closeToolbarDropdowns(this.container);
      const active = this.container.ownerDocument.activeElement;
      if (focusToggle || (active && this.drawer.contains(active))) this.toggleButton.focus();
    }
  }
}

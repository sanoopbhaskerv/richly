import type { Editor } from '../../editor/Editor';
import { icons } from '../icons';
import type { ToolbarLayoutServices } from './ToolbarModel';

/**
 * Single-row toolbar strategy that moves trailing sections into a More panel.
 *
 * The controller owns only responsive DOM distribution and its lifecycle. It
 * receives measurements from the coordinator so measurement behavior remains
 * replaceable and independently testable.
 */
export class OverflowToolbar {
  readonly toggleButton: HTMLButtonElement;

  private readonly wrap: HTMLElement;
  private readonly panel: HTMLElement;

  constructor(
    editor: Editor,
    private readonly container: HTMLElement,
    private readonly sections: HTMLElement[][],
    private readonly layout: ToolbarLayoutServices
  ) {
    const doc = container.ownerDocument;
    const view = doc.defaultView;
    container.classList.add('rly-toolbar-overflow-enabled');

    this.wrap = doc.createElement('div');
    this.wrap.className = 'rly-toolbar-overflow';
    this.wrap.hidden = true;

    this.toggleButton = doc.createElement('button');
    this.toggleButton.type = 'button';
    this.toggleButton.className = 'rly-tb-btn';
    this.toggleButton.dataset.testid = 'tb-more';
    this.toggleButton.innerHTML = icons.more ?? '•••';
    this.toggleButton.title = 'More tools';
    this.toggleButton.setAttribute('aria-label', 'More tools');
    this.toggleButton.setAttribute('aria-haspopup', 'true');
    this.toggleButton.setAttribute('aria-expanded', 'false');
    this.toggleButton.addEventListener('mousedown', (event) => event.preventDefault());

    this.panel = doc.createElement('div');
    this.panel.className = 'rly-toolbar-overflow-panel';
    this.panel.dataset.testid = 'toolbar-more-panel';
    this.panel.setAttribute('role', 'group');
    this.panel.setAttribute('aria-label', 'More editor tools');
    this.panel.addEventListener('mousedown', (event) => event.preventDefault());

    /** Keep the floating overflow surface inside the current viewport. */
    const positionPanel = (): void => {
      if (!view || !this.panel.classList.contains('rly-open')) return;
      this.panel.style.left = '';
      this.panel.style.right = '0';
      this.panel.style.top = '100%';
      this.panel.style.bottom = '';
      this.panel.style.marginTop = '4px';
      this.panel.style.marginBottom = '';
      this.panel.style.maxHeight = '';

      const margin = 8;
      const triggerRect = this.wrap.getBoundingClientRect();
      const panelRect = this.panel.getBoundingClientRect();
      if (panelRect.left < margin) {
        this.panel.style.left = `${margin - triggerRect.left}px`;
        this.panel.style.right = 'auto';
      }

      const below = view.innerHeight - triggerRect.bottom - margin - 4;
      const above = triggerRect.top - margin - 4;
      const placeAbove = panelRect.height > below && above > below;
      const availableHeight = Math.max(80, placeAbove ? above : below);
      this.panel.style.maxHeight = `${availableHeight}px`;
      if (placeAbove) {
        this.panel.style.top = 'auto';
        this.panel.style.bottom = '100%';
        this.panel.style.marginTop = '';
        this.panel.style.marginBottom = '4px';
      }
    };

    const close = (): void => {
      this.panel.classList.remove('rly-open');
      this.panel
        .querySelectorAll('.rly-tb-dd.rly-open')
        .forEach((item) => item.classList.remove('rly-open'));
      this.toggleButton.setAttribute('aria-expanded', 'false');
    };
    this.toggleButton.addEventListener('click', (event) => {
      event.stopPropagation();
      const open = !this.panel.classList.contains('rly-open');
      close();
      if (open) {
        this.panel.classList.add('rly-open');
        this.toggleButton.setAttribute('aria-expanded', 'true');
        positionPanel();
        view?.requestAnimationFrame(positionPanel);
      }
    });
    const onDocumentClick = (): void => close();
    const onDocumentKeydown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || !this.panel.classList.contains('rly-open')) return;
      event.preventDefault();
      close();
      this.toggleButton.focus();
    };
    doc.addEventListener('click', onDocumentClick);
    doc.addEventListener('keydown', onDocumentKeydown);

    this.wrap.append(this.toggleButton, this.panel);
    container.appendChild(this.wrap);

    let destroyed = false;
    let initialFrame: number | null = null;
    const refresh = (): void => {
      if (destroyed || !container.isConnected) return;
      this.refresh();
    };
    const observer = view?.ResizeObserver ? new view.ResizeObserver(refresh) : null;
    observer?.observe(container);
    // Host grids and framework wrappers can constrain a toolbar even while its
    // own intrinsic width remains unchanged, so observe the nearby boundaries.
    if (container.parentElement) observer?.observe(container.parentElement);
    if (container.parentElement?.parentElement) {
      observer?.observe(container.parentElement.parentElement);
    }
    const onViewportChange = (): void => {
      refresh();
      positionPanel();
    };
    view?.addEventListener('resize', onViewportChange);
    view?.addEventListener('scroll', positionPanel, true);
    editor.events.on('destroy', () => {
      destroyed = true;
      observer?.disconnect();
      view?.removeEventListener('resize', onViewportChange);
      view?.removeEventListener('scroll', positionPanel, true);
      doc.removeEventListener('click', onDocumentClick);
      doc.removeEventListener('keydown', onDocumentKeydown);
      if (initialFrame !== null) view?.cancelAnimationFrame(initialFrame);
      initialFrame = null;
    });

    if (view?.requestAnimationFrame) initialFrame = view.requestAnimationFrame(refresh);
    else queueMicrotask(refresh);
  }

  /** Restore source order, then move complete trailing sections until it fits. */
  private refresh(): void {
    for (const section of this.sections) {
      for (const item of section) this.container.insertBefore(item, this.wrap);
    }
    this.panel.replaceChildren();
    this.panel.classList.remove('rly-open');
    this.wrap.hidden = true;
    this.toggleButton.setAttribute('aria-expanded', 'false');

    // Inline-size containment means scrollWidth is not a reliable signal in
    // every grid/flex layout; sum the actual rendered children instead.
    const availableWidth = this.layout.availableWidth();
    const occupiedWidth = (): number => this.layout.occupiedWidth(this.container);
    // jsdom and detached editors have no measurable width.
    if (availableWidth <= 0 || occupiedWidth() <= availableWidth) return;

    this.wrap.hidden = false;
    for (let index = this.sections.length - 1; index >= 0; index--) {
      if (occupiedWidth() <= availableWidth) break;
      this.panel.prepend(...this.sections[index]!);
    }
  }
}

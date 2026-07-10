import type { Editor } from '../editor/Editor';
import { icons } from './icons';

/**
 * Renders a toolbar from a spec string: "undo redo | bold italic | h1 h2".
 * data-testid convention (TESTING.md §4): tb-<name>.
 */
export class Toolbar {
  private toggles: { name: string; el: HTMLButtonElement; command: string }[] = [];
  private buttons: HTMLButtonElement[] = [];
  private sections: HTMLElement[][] = [];
  private moreWrap: HTMLElement | null = null;
  private morePanel: HTMLElement | null = null;

  constructor(
    private editor: Editor,
    private container: HTMLElement,
    spec: string,
    overflow = false
  ) {
    container.setAttribute('role', 'toolbar');
    container.setAttribute('aria-label', 'Editor toolbar');
    this.render(spec);
    if (overflow) this.installOverflow();
    editor.events.on('selectionchange', () => this.refresh());
    editor.events.on('change', () => this.refresh());
    editor.events.on('execcommand', () => this.refresh());
    this.installRovingTabindex();
  }

  private render(spec: string): void {
    const doc = this.container.ownerDocument;
    const groups = spec.split('|').map((g) => g.trim().split(/\s+/).filter(Boolean));
    groups.forEach((names, gi) => {
      const section: HTMLElement[] = [];
      if (gi > 0) {
        const sep = doc.createElement('div');
        sep.className = 'sbe-tb-sep';
        this.container.appendChild(sep);
        section.push(sep);
      }
      const groupEl = doc.createElement('div');
      groupEl.className = 'sbe-tb-group';
      for (const name of names) {
        const buttonSpec = this.editor.ui.buttons.get(name);
        if (!buttonSpec) continue;
        const btn = doc.createElement('button');
        btn.type = 'button';
        btn.className = 'sbe-tb-btn';
        btn.dataset.testid = `tb-${name}`;
        btn.setAttribute('aria-label', buttonSpec.tooltip);
        // data-tooltip drives the CSS ::after tooltip; no native title so the OS
        // tooltip doesn't double-show.
        const tooltipText = buttonSpec.shortcut
          ? `${buttonSpec.tooltip} (${buttonSpec.shortcut})`
          : buttonSpec.tooltip;
        btn.innerHTML = icons[buttonSpec.icon] ?? buttonSpec.icon;
        if (buttonSpec.toggle) btn.setAttribute('aria-pressed', 'false');
        // Preventing mousedown focus loss keeps the content selection intact.
        btn.addEventListener('mousedown', (e) => e.preventDefault());

        if (buttonSpec.panel) {
          // Dropdown button (e.g. table grid picker).
          const wrap = doc.createElement('div');
          wrap.className = 'sbe-tb-wrap';
          // Tooltip on the wrap so ::after anchors to the full button area.
          wrap.dataset.tooltip = tooltipText;
          const dd = doc.createElement('div');
          dd.className = 'sbe-tb-dd';
          dd.dataset.testid = `dd-${name}`;
          // Clicks inside the panel must not steal the content selection.
          dd.addEventListener('mousedown', (e) => e.preventDefault());
          const close = (): void => {
            // Clear any dynamic positioning so CSS defaults apply next time.
            dd.style.left = '';
            dd.style.right = '';
            dd.classList.remove('sbe-open');
          };
          dd.appendChild(buttonSpec.panel(this.editor, close));
          btn.setAttribute('aria-haspopup', 'true');
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const wasOpen = dd.classList.contains('sbe-open');
            doc.querySelectorAll('.sbe-tb-dd').forEach((p) => {
              const el = p as HTMLElement;
              el.style.left = '';
              el.style.right = '';
              el.classList.remove('sbe-open');
            });
            if (!wasOpen) {
              // Reset to CSS default so getBoundingClientRect reflects the
              // natural (right: 0) position before we override it.
              dd.style.left = '';
              dd.style.right = '';
              dd.classList.add('sbe-open');
              dd.firstElementChild?.dispatchEvent(
                new (doc.defaultView?.Event ?? Event)('sbe-panel-open')
              );
              // Dynamically clamp the panel so it never overflows either
              // viewport edge. We measure after a rAF so the browser has
              // painted the panel at its natural position.
              const view = doc.defaultView;
              if (view) {
                requestAnimationFrame(() => {
                  const panelRect = dd.getBoundingClientRect();
                  const wrapRect = wrap.getBoundingClientRect();
                  const margin = 8;
                  const vpWidth = view.innerWidth;

                  // Natural desired left in viewport coords: right-align panel to wrap.
                  const naturalLeft = wrapRect.right - panelRect.width;
                  // Clamp so the panel stays fully inside the viewport.
                  const clampedLeft = Math.max(
                    margin,
                    Math.min(vpWidth - panelRect.width - margin, naturalLeft)
                  );
                  // Convert from viewport coords to local coords
                  // (relative to the wrap, which is the CSS containing block).
                  const localLeft = clampedLeft - wrapRect.left;
                  dd.style.left = `${localLeft}px`;
                  dd.style.right = 'auto';
                });
              }
            }
          });
          doc.addEventListener('click', close);
          this.editor.events.on('destroy', () => doc.removeEventListener('click', close));
          wrap.append(btn, dd);
          groupEl.appendChild(wrap);
        } else if (buttonSpec.command) {
          const command = buttonSpec.command;
          // Plain (non-panel) button gets the tooltip directly.
          btn.dataset.tooltip = tooltipText;
          btn.addEventListener('click', () => {
            this.editor.execCommand(command, buttonSpec.args);
            // Don't steal focus back if the command opened a modal dialog.
            if (!doc.querySelector('.sbe-dialog-overlay')) this.editor.focus();
          });
          groupEl.appendChild(btn);
          if (buttonSpec.toggle) this.toggles.push({ name, el: btn, command });
        } else {
          // No command, no panel — still show tooltip.
          btn.dataset.tooltip = tooltipText;
          groupEl.appendChild(btn);
        }
        this.buttons.push(btn);
      }
      this.container.appendChild(groupEl);
      section.push(groupEl);
      this.sections.push(section);
    });
  }

  /** Keep the toolbar on one row and move whole groups into a More panel. */
  private installOverflow(): void {
    const doc = this.container.ownerDocument;
    const view = doc.defaultView;
    this.container.classList.add('sbe-toolbar-overflow-enabled');
    const wrap = doc.createElement('div');
    wrap.className = 'sbe-toolbar-overflow';
    wrap.hidden = true;

    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'sbe-tb-btn';
    button.dataset.testid = 'tb-more';
    button.innerHTML = icons.more ?? '•••';
    button.title = 'More tools';
    button.setAttribute('aria-label', 'More tools');
    button.setAttribute('aria-haspopup', 'true');
    button.setAttribute('aria-expanded', 'false');
    button.addEventListener('mousedown', (e) => e.preventDefault());

    const panel = doc.createElement('div');
    panel.className = 'sbe-toolbar-overflow-panel';
    panel.dataset.testid = 'toolbar-more-panel';
    panel.setAttribute('role', 'group');
    panel.setAttribute('aria-label', 'More editor tools');
    panel.addEventListener('mousedown', (e) => e.preventDefault());

    const close = (): void => {
      panel.classList.remove('sbe-open');
      panel
        .querySelectorAll('.sbe-tb-dd.sbe-open')
        .forEach((item) => item.classList.remove('sbe-open'));
      button.setAttribute('aria-expanded', 'false');
    };
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = !panel.classList.contains('sbe-open');
      close();
      if (open) {
        panel.classList.add('sbe-open');
        button.setAttribute('aria-expanded', 'true');
      }
    });
    const onDocumentClick = (): void => close();
    doc.addEventListener('click', onDocumentClick);

    wrap.append(button, panel);
    this.container.appendChild(wrap);
    this.moreWrap = wrap;
    this.morePanel = panel;
    this.buttons.push(button);

    const refresh = (): void => this.refreshOverflow();
    const observer = view?.ResizeObserver ? new view.ResizeObserver(refresh) : null;
    observer?.observe(this.container);
    view?.addEventListener('resize', refresh);
    this.editor.events.on('destroy', () => {
      observer?.disconnect();
      view?.removeEventListener('resize', refresh);
      doc.removeEventListener('click', onDocumentClick);
    });

    if (view?.requestAnimationFrame) view.requestAnimationFrame(refresh);
    else queueMicrotask(refresh);
  }

  private refreshOverflow(): void {
    const wrap = this.moreWrap;
    const panel = this.morePanel;
    if (!wrap || !panel) return;

    // Restore the source order before recalculating available space.
    for (const section of this.sections) {
      for (const item of section) this.container.insertBefore(item, wrap);
    }
    panel.replaceChildren();
    panel.classList.remove('sbe-open');
    wrap.hidden = true;
    const moreButton = wrap.querySelector('button');
    moreButton?.setAttribute('aria-expanded', 'false');

    // Measure the actual children instead of scrollWidth. Inline-size containment keeps
    // the editor shrinkable inside grids/flex layouts, so overflowing paint is not
    // guaranteed to be represented by scrollWidth in every browser.
    const view = this.container.ownerDocument.defaultView;
    const styles = view?.getComputedStyle(this.container);
    const padding =
      Number.parseFloat(styles?.paddingLeft ?? '0') +
      Number.parseFloat(styles?.paddingRight ?? '0');
    const gap = Number.parseFloat(styles?.columnGap ?? styles?.gap ?? '0');
    const availableWidth = this.container.clientWidth - padding;
    const occupiedWidth = (): number => {
      const children = Array.from(this.container.children).filter(
        (child): child is HTMLElement => !(child as HTMLElement).hidden
      );
      return (
        children.reduce((width, child) => width + child.getBoundingClientRect().width, 0) +
        Math.max(0, children.length - 1) * gap
      );
    };

    // jsdom and detached editors have no measurable width.
    if (availableWidth <= 0 || occupiedWidth() <= availableWidth) return;

    wrap.hidden = false;
    for (let i = this.sections.length - 1; i >= 0; i--) {
      if (occupiedWidth() <= availableWidth) break;
      panel.prepend(...this.sections[i]!);
    }
  }

  refresh(): void {
    for (const t of this.toggles) {
      const active = this.editor.queryCommandState(t.command);
      t.el.classList.toggle('sbe-active', active);
      t.el.setAttribute('aria-pressed', String(active));
    }
  }

  /** Roving tabindex + arrow-key navigation (a11y). */
  private installRovingTabindex(): void {
    this.buttons.forEach((b, i) => (b.tabIndex = i === 0 ? 0 : -1));
    this.container.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const available = this.buttons.filter((button) => {
        if (button.hidden || button.closest('[hidden]')) return false;
        const overflow = button.closest('.sbe-toolbar-overflow-panel');
        return !overflow || overflow.classList.contains('sbe-open');
      });
      const idx = available.findIndex((b) => b === this.container.ownerDocument.activeElement);
      if (idx === -1) return;
      e.preventDefault();
      const next =
        e.key === 'ArrowRight'
          ? (idx + 1) % available.length
          : (idx - 1 + available.length) % available.length;
      this.buttons.forEach((b) => (b.tabIndex = -1));
      available[next]!.tabIndex = 0;
      available[next]!.focus();
    });
  }
}

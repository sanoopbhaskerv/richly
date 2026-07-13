import type { Editor } from '../editor/Editor';
import type { ToolbarMode } from '../editor/Editor';
import { icons } from './icons';

/**
 * Renders a toolbar from a spec string: "undo redo | bold italic | h1 h2".
 * data-testid convention (TESTING.md §4): tb-<name>.
 */
export class Toolbar {
  private toggles: { name: string; el: HTMLButtonElement; command: string }[] = [];
  private selects: { name: string; el: HTMLSelectElement; command: string }[] = [];
  private valueIndicators: { el: HTMLButtonElement; command: string }[] = [];
  private buttons: HTMLElement[] = [];
  private sections: HTMLElement[][] = [];
  private moreWrap: HTMLElement | null = null;
  private morePanel: HTMLElement | null = null;

  constructor(
    private editor: Editor,
    private container: HTMLElement,
    spec: string,
    mode: ToolbarMode = 'wrap'
  ) {
    container.setAttribute('role', 'toolbar');
    container.setAttribute('aria-label', 'Editor toolbar');
    this.render(spec);
    if (mode === 'more') this.installOverflow();
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
        sep.className = 'rly-tb-sep';
        this.container.appendChild(sep);
        section.push(sep);
      }
      const groupEl = doc.createElement('div');
      groupEl.className = 'rly-tb-group';
      for (const name of names) {
        const buttonSpec = this.editor.ui.buttons.get(name);
        if (!buttonSpec) continue;
        if (buttonSpec.type === 'component') {
          groupEl.appendChild(buttonSpec.render(this.editor));
          continue;
        }
        if (buttonSpec.type === 'select') {
          const select = doc.createElement('select');
          select.className = 'rly-tb-select';
          select.dataset.testid = `tb-select-${name}`;
          select.setAttribute('aria-label', buttonSpec.tooltip);
          buttonSpec.options.forEach((optionSpec) => {
            const option = doc.createElement('option');
            option.textContent = optionSpec.label;
            option.value = optionSpec.value;
            select.appendChild(option);
          });
          select.addEventListener('change', () => {
            this.editor.execCommand(buttonSpec.command, select.value);
          });
          groupEl.appendChild(select);
          this.selects.push({ name, el: select, command: buttonSpec.command });
          this.buttons.push(select);
          continue;
        }

        const btn = doc.createElement('button');
        btn.type = 'button';
        btn.className = 'rly-tb-btn';
        btn.dataset.testid = `tb-${name}`;
        btn.setAttribute('aria-label', buttonSpec.tooltip);
        // data-tooltip drives the CSS ::after tooltip; no native title so the OS
        // tooltip doesn't double-show.
        const tooltipText = buttonSpec.shortcut
          ? `${buttonSpec.tooltip} (${buttonSpec.shortcut})`
          : buttonSpec.tooltip;
        btn.innerHTML = icons[buttonSpec.icon] ?? buttonSpec.icon;
        if (buttonSpec.type === 'toggle') btn.setAttribute('aria-pressed', 'false');
        // Preventing mousedown focus loss keeps the content selection intact.
        btn.addEventListener('mousedown', (e) => e.preventDefault());

        if (buttonSpec.type === 'panel') {
          // Dropdown button (e.g. table grid picker).
          const wrap = doc.createElement('div');
          wrap.className = 'rly-tb-wrap';
          // Tooltip on the wrap so ::after anchors to the full button area.
          wrap.dataset.tooltip = tooltipText;
          const dd = doc.createElement('div');
          dd.className = 'rly-tb-dd';
          dd.dataset.testid = `dd-${name}`;
          // Simple panels keep the content selection live. Rich interactive
          // panels restore their saved bookmark before applying a command.
          dd.addEventListener('mousedown', (e) => {
            const target = e.target as Element | null;
            if (target?.closest('.rly-color-picker[data-view="custom"]')) return;
            e.preventDefault();
          });
          dd.addEventListener('click', (e) => e.stopPropagation());
          const resetPosition = (): void => {
            dd.style.left = '';
            dd.style.right = '';
            dd.style.top = '';
            dd.style.bottom = '';
            dd.style.marginTop = '';
            dd.style.marginBottom = '';
          };
          const positionPanel = (): void => {
            const view = doc.defaultView;
            if (!view) return;
            const update = (): void => {
              if (!dd.classList.contains('rly-open')) return;
              resetPosition();
              const panelRect = dd.getBoundingClientRect();
              const wrapRect = wrap.getBoundingClientRect();
              const margin = 8;
              const naturalLeft = wrapRect.right - panelRect.width;
              const clampedLeft = Math.max(
                margin,
                Math.min(view.innerWidth - panelRect.width - margin, naturalLeft)
              );
              dd.style.left = `${clampedLeft - wrapRect.left}px`;
              dd.style.right = 'auto';

              const fitsBelow = wrapRect.bottom + 4 + panelRect.height <= view.innerHeight - margin;
              const fitsAbove = wrapRect.top - 4 - panelRect.height >= margin;
              if (!fitsBelow && fitsAbove) {
                dd.style.top = 'auto';
                dd.style.bottom = '100%';
                dd.style.marginTop = '0';
                dd.style.marginBottom = '4px';
              } else if (!fitsBelow) {
                dd.style.top = `${margin - wrapRect.top}px`;
                dd.style.marginTop = '0';
              }
            };
            // Update immediately for view switches, then once after layout so
            // font loading and responsive styles cannot leave stale bounds.
            update();
            view.requestAnimationFrame(update);
          };
          const close = (): void => {
            resetPosition();
            dd.classList.remove('rly-open');
            btn.setAttribute('aria-expanded', 'false');
          };
          dd.addEventListener('rly-panel-resize', positionPanel);
          const panelContent = buttonSpec.panel(this.editor, close);
          dd.appendChild(panelContent);
          if (panelContent.classList.contains('rly-color-picker')) {
            dd.classList.add('rly-tb-dd-color');
          }
          if (buttonSpec.valueCommand) {
            btn.classList.add('rly-value-indicator');
            this.valueIndicators.push({ el: btn, command: buttonSpec.valueCommand });
          }
          btn.setAttribute('aria-haspopup', 'true');
          btn.setAttribute('aria-expanded', 'false');
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const wasOpen = dd.classList.contains('rly-open');
            doc.querySelectorAll('.rly-tb-dd').forEach((p) => {
              const el = p as HTMLElement;
              el.style.left = '';
              el.style.right = '';
              el.style.top = '';
              el.style.bottom = '';
              el.style.marginTop = '';
              el.style.marginBottom = '';
              el.classList.remove('rly-open');
              el.parentElement
                ?.querySelector(':scope > button')
                ?.setAttribute('aria-expanded', 'false');
            });
            if (!wasOpen) {
              // Reset to CSS default so getBoundingClientRect reflects the
              // natural (right: 0) position before we override it.
              dd.style.left = '';
              dd.style.right = '';
              dd.classList.add('rly-open');
              btn.setAttribute('aria-expanded', 'true');
              dd.firstElementChild?.dispatchEvent(
                new (doc.defaultView?.Event ?? Event)('rly-panel-open')
              );
              positionPanel();
            }
          });
          doc.addEventListener('click', close);
          this.editor.events.on('destroy', () => doc.removeEventListener('click', close));
          wrap.append(btn, dd);
          groupEl.appendChild(wrap);
        } else {
          // Plain button (momentary or toggle) gets the tooltip directly.
          btn.dataset.tooltip = tooltipText;
          btn.addEventListener('click', () => {
            this.editor.execCommand(
              buttonSpec.command,
              buttonSpec.type === 'button' ? buttonSpec.args : undefined
            );
            // Don't steal focus back if the command opened a modal dialog.
            if (!doc.querySelector('.rly-dialog-overlay')) this.editor.focus();
          });
          groupEl.appendChild(btn);
          if (buttonSpec.type === 'toggle')
            this.toggles.push({ name, el: btn, command: buttonSpec.command });
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
    this.container.classList.add('rly-toolbar-overflow-enabled');
    const wrap = doc.createElement('div');
    wrap.className = 'rly-toolbar-overflow';
    wrap.hidden = true;

    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'rly-tb-btn';
    button.dataset.testid = 'tb-more';
    button.innerHTML = icons.more ?? '•••';
    button.title = 'More tools';
    button.setAttribute('aria-label', 'More tools');
    button.setAttribute('aria-haspopup', 'true');
    button.setAttribute('aria-expanded', 'false');
    button.addEventListener('mousedown', (e) => e.preventDefault());

    const panel = doc.createElement('div');
    panel.className = 'rly-toolbar-overflow-panel';
    panel.dataset.testid = 'toolbar-more-panel';
    panel.setAttribute('role', 'group');
    panel.setAttribute('aria-label', 'More editor tools');
    panel.addEventListener('mousedown', (e) => e.preventDefault());

    const close = (): void => {
      panel.classList.remove('rly-open');
      panel
        .querySelectorAll('.rly-tb-dd.rly-open')
        .forEach((item) => item.classList.remove('rly-open'));
      button.setAttribute('aria-expanded', 'false');
    };
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = !panel.classList.contains('rly-open');
      close();
      if (open) {
        panel.classList.add('rly-open');
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
    // A flex/grid consumer can allow the toolbar to report its intrinsic width
    // even though the editor host is narrower. Observe both bounds so a host
    // resize still recalculates the groups that belong in More.
    if (this.container.parentElement) observer?.observe(this.container.parentElement);
    if (this.container.parentElement?.parentElement) {
      observer?.observe(this.container.parentElement.parentElement);
    }
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
    panel.classList.remove('rly-open');
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
    // Never trust only the toolbar width: in min-content flex/grid layouts it
    // can grow wider than its editor or consumer host. Use the narrowest
    // measurable boundary so groups collapse before they paint outside it.
    const boundaryWidths = [
      this.container.clientWidth,
      this.container.parentElement?.clientWidth,
      this.container.parentElement?.parentElement?.clientWidth
    ].filter((width): width is number => typeof width === 'number' && width > 0);
    const availableWidth = Math.min(...boundaryWidths) - padding;
    const occupiedWidth = (): number => {
      const children = Array.from(this.container.children).filter(
        (child): child is HTMLElement => !(child as HTMLElement).hidden
      );
      const outerWidth = (child: HTMLElement): number => {
        const childStyles = view?.getComputedStyle(child);
        const marginLeft = Number.parseFloat(childStyles?.marginLeft ?? '0');
        const marginRight = Number.parseFloat(childStyles?.marginRight ?? '0');
        return (
          child.getBoundingClientRect().width +
          (Number.isFinite(marginLeft) ? marginLeft : 0) +
          (Number.isFinite(marginRight) ? marginRight : 0)
        );
      };
      return (
        children.reduce((width, child) => width + outerWidth(child), 0) +
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
    for (const indicator of this.valueIndicators) {
      const value = this.editor.queryCommandValue(indicator.command);
      if (value) indicator.el.style.setProperty('--rly-control-value', value);
      else indicator.el.style.removeProperty('--rly-control-value');
    }
    for (const s of this.selects) {
      const value = this.editor.queryCommandValue(s.command);
      s.el.querySelector('.rly-temp-option')?.remove();
      const hasPreset = Array.from(s.el.options).some((option) => option.value === value);
      if (value && !hasPreset) {
        const opt = this.container.ownerDocument.createElement('option');
        opt.value = value;
        opt.textContent = value;
        opt.className = 'rly-temp-option';
        s.el.appendChild(opt);
      }
      s.el.value = value;
    }
    for (const t of this.toggles) {
      const active = this.editor.queryCommandState(t.command);
      t.el.classList.toggle('rly-active', active);
      t.el.setAttribute('aria-pressed', String(active));
    }
  }

  /** Roving tabindex + arrow-key navigation (a11y). */
  private installRovingTabindex(): void {
    this.buttons.forEach((b, i) => (b.tabIndex = i === 0 ? 0 : -1));
    this.container.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const activeEl = this.container.ownerDocument.activeElement;
      if (activeEl?.nodeName === 'SELECT') return;
      const available = this.buttons.filter((button) => {
        if (button.hidden || button.closest('[hidden]')) return false;
        const overflow = button.closest('.rly-toolbar-overflow-panel');
        return !overflow || overflow.classList.contains('rly-open');
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

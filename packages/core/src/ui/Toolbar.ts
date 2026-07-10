import type { Editor } from '../editor/Editor';
import { icons } from './icons';

/**
 * Renders a toolbar from a spec string: "undo redo | bold italic | h1 h2".
 * data-testid convention (TESTING.md §4): tb-<name>.
 */
export class Toolbar {
  private toggles: { name: string; el: HTMLButtonElement; command: string }[] = [];
  private buttons: HTMLButtonElement[] = [];

  constructor(
    private editor: Editor,
    private container: HTMLElement,
    spec: string
  ) {
    container.setAttribute('role', 'toolbar');
    container.setAttribute('aria-label', 'Editor toolbar');
    this.render(spec);
    editor.events.on('selectionchange', () => this.refresh());
    editor.events.on('change', () => this.refresh());
    editor.events.on('execcommand', () => this.refresh());
    this.installRovingTabindex();
  }

  private render(spec: string): void {
    const doc = this.container.ownerDocument;
    const groups = spec.split('|').map((g) => g.trim().split(/\s+/).filter(Boolean));
    groups.forEach((names, gi) => {
      if (gi > 0) {
        const sep = doc.createElement('div');
        sep.className = 'sbe-tb-sep';
        this.container.appendChild(sep);
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
        btn.title = buttonSpec.shortcut
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
          const dd = doc.createElement('div');
          dd.className = 'sbe-tb-dd';
          dd.dataset.testid = `dd-${name}`;
          // Clicks inside the panel must not steal the content selection.
          dd.addEventListener('mousedown', (e) => e.preventDefault());
          const close = (): void => dd.classList.remove('sbe-open');
          dd.appendChild(buttonSpec.panel(this.editor, close));
          btn.setAttribute('aria-haspopup', 'true');
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const wasOpen = dd.classList.contains('sbe-open');
            doc.querySelectorAll('.sbe-tb-dd').forEach((p) => p.classList.remove('sbe-open'));
            if (!wasOpen) {
              dd.classList.add('sbe-open');
              dd.firstElementChild?.dispatchEvent(
                new (doc.defaultView?.Event ?? Event)('sbe-panel-open')
              );
            }
          });
          doc.addEventListener('click', close);
          this.editor.events.on('destroy', () => doc.removeEventListener('click', close));
          wrap.append(btn, dd);
          groupEl.appendChild(wrap);
        } else if (buttonSpec.command) {
          const command = buttonSpec.command;
          btn.addEventListener('click', () => {
            this.editor.execCommand(command, buttonSpec.args);
            // Don't steal focus back if the command opened a modal dialog.
            if (!doc.querySelector('.sbe-dialog-overlay')) this.editor.focus();
          });
          groupEl.appendChild(btn);
          if (buttonSpec.toggle) this.toggles.push({ name, el: btn, command });
        } else {
          groupEl.appendChild(btn);
        }
        this.buttons.push(btn);
      }
      this.container.appendChild(groupEl);
    });
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
      const idx = this.buttons.findIndex((b) => b === this.container.ownerDocument.activeElement);
      if (idx === -1) return;
      e.preventDefault();
      const next =
        e.key === 'ArrowRight'
          ? (idx + 1) % this.buttons.length
          : (idx - 1 + this.buttons.length) % this.buttons.length;
      this.buttons.forEach((b, i) => (b.tabIndex = i === next ? 0 : -1));
      this.buttons[next]?.focus();
    });
  }
}

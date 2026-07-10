import type { Editor } from '../editor/Editor';

const MENU_ORDER = ['file', 'edit', 'view', 'insert', 'format', 'tools', 'table', 'help'];

function shortcutLabel(shortcut: string, doc: Document): string {
  const isMac = /Mac|iP/.test(doc.defaultView?.navigator.platform ?? '');
  return shortcut
    .replace(/Mod\+/g, isMac ? '⌘' : 'Ctrl+')
    .replace(/Shift\+/g, isMac ? '⇧' : 'Shift+')
    .replace(/Alt\+/g, isMac ? '⌥' : 'Alt+');
}

/**
 * Registry-driven menubar. Only menus that have registered items are shown.
 * data-testids: menu-<name> (menubar button), menuitem-<id> (entries).
 */
export class Menubar {
  private openPanel: HTMLElement | null = null;
  private docListener: (e: MouseEvent) => void;

  constructor(
    private editor: Editor,
    private container: HTMLElement
  ) {
    const doc = container.ownerDocument;
    container.setAttribute('role', 'menubar');

    // Group registered items by menu, preserving registration order.
    const groups = new Map<
      string,
      { id: string; text: string; command: string; args?: unknown; shortcut?: string }[]
    >();
    editor.ui.menuItems.forEach((spec, id) => {
      if (!groups.has(spec.menu)) groups.set(spec.menu, []);
      groups.get(spec.menu)!.push({ id, ...spec });
    });

    for (const menu of MENU_ORDER) {
      const items = groups.get(menu);
      if (!items?.length) continue;

      const btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'rly-menu-btn';
      btn.dataset.testid = `menu-${menu}`;
      btn.textContent = menu[0]!.toUpperCase() + menu.slice(1);
      btn.setAttribute('aria-haspopup', 'true');
      btn.setAttribute('aria-expanded', 'false');

      const panel = doc.createElement('div');
      panel.className = 'rly-menu-dd';
      panel.setAttribute('role', 'menu');

      for (const item of items) {
        const entry = doc.createElement('button');
        entry.type = 'button';
        entry.className = 'rly-menu-item';
        entry.dataset.testid = `menuitem-${item.id}`;
        entry.setAttribute('role', 'menuitem');
        const label = doc.createElement('span');
        label.textContent = item.text;
        entry.appendChild(label);
        if (item.shortcut) {
          const kbd = doc.createElement('span');
          kbd.className = 'rly-kbd';
          kbd.textContent = shortcutLabel(item.shortcut, doc);
          entry.appendChild(kbd);
        }
        entry.addEventListener('mousedown', (e) => e.preventDefault()); // keep content selection
        entry.addEventListener('click', () => {
          this.closeAll();
          this.editor.execCommand(item.command, item.args);
          this.editor.focus();
        });
        panel.appendChild(entry);
      }

      const wrap = doc.createElement('div');
      wrap.className = 'rly-menu-wrap';
      wrap.append(btn, panel);
      container.appendChild(wrap);

      btn.addEventListener('mousedown', (e) => e.preventDefault());
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const wasOpen = this.openPanel === panel;
        this.closeAll();
        if (!wasOpen) {
          panel.classList.add('rly-open');
          btn.setAttribute('aria-expanded', 'true');
          this.openPanel = panel;
        }
      });
    }

    this.docListener = () => this.closeAll();
    doc.addEventListener('click', this.docListener);
    container.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeAll();
    });
    editor.events.on('destroy', () => doc.removeEventListener('click', this.docListener));
  }

  private closeAll(): void {
    this.container.querySelectorAll('.rly-menu-dd').forEach((p) => p.classList.remove('rly-open'));
    this.container
      .querySelectorAll('.rly-menu-btn')
      .forEach((b) => b.setAttribute('aria-expanded', 'false'));
    this.openPanel = null;
  }
}

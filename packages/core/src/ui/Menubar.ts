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
  private menus: { button: HTMLButtonElement; panel: HTMLElement }[] = [];

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
      btn.setAttribute('role', 'menuitem');
      btn.dataset.testid = `menu-${menu}`;
      btn.textContent = menu[0]!.toUpperCase() + menu.slice(1);
      btn.id = `rly-menu-${menu}`;
      btn.setAttribute('aria-haspopup', 'menu');
      btn.setAttribute('aria-expanded', 'false');

      const panel = doc.createElement('div');
      panel.className = 'rly-menu-dd';
      panel.setAttribute('role', 'menu');
      panel.setAttribute('aria-labelledby', btn.id);

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
      wrap.setAttribute('role', 'none');
      wrap.append(btn, panel);
      container.appendChild(wrap);
      this.menus.push({ button: btn, panel });

      btn.addEventListener('mousedown', (e) => e.preventDefault());
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const wasOpen = this.openPanel === panel;
        this.closeAll();
        if (!wasOpen) {
          this.open(btn, panel);
        }
      });
    }

    this.docListener = () => this.closeAll();
    doc.addEventListener('click', this.docListener);
    container.addEventListener('keydown', (e) => this.onKeyDown(e));
    editor.events.on('destroy', () => doc.removeEventListener('click', this.docListener));
  }

  private open(button: HTMLButtonElement, panel: HTMLElement, focusFirst = false): void {
    panel.classList.add('rly-open');
    button.setAttribute('aria-expanded', 'true');
    this.openPanel = panel;
    if (focusFirst)
      panel.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus();
  }

  private focusAdjacentMenu(current: HTMLButtonElement, offset: number, open: boolean): void {
    const index = this.menus.findIndex(({ button }) => button === current);
    if (index < 0 || !this.menus.length) return;
    const next = this.menus[(index + offset + this.menus.length) % this.menus.length]!;
    this.closeAll();
    next.button.focus();
    if (open) this.open(next.button, next.panel, true);
  }

  private onKeyDown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    const menuItem = target.closest<HTMLButtonElement>('[role="menuitem"]');
    const menuButton = target.closest<HTMLButtonElement>('.rly-menu-btn');

    if (menuButton) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        const entry = this.menus.find(({ button }) => button === menuButton);
        if (entry) {
          this.closeAll();
          this.open(entry.button, entry.panel, true);
        }
      } else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        this.focusAdjacentMenu(menuButton, event.key === 'ArrowRight' ? 1 : -1, false);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        this.closeAll();
        menuButton.focus();
      }
      return;
    }

    if (!menuItem) return;
    const panel = menuItem.closest<HTMLElement>('[role="menu"]');
    const owner = this.menus.find(({ panel: candidate }) => candidate === panel);
    if (!panel || !owner) return;
    const items = Array.from(
      panel.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')
    );
    const index = items.indexOf(menuItem);

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const offset = event.key === 'ArrowDown' ? 1 : -1;
      items[(index + offset + items.length) % items.length]?.focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      items[event.key === 'Home' ? 0 : items.length - 1]?.focus();
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      this.focusAdjacentMenu(owner.button, event.key === 'ArrowRight' ? 1 : -1, true);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.closeAll();
      owner.button.focus();
    } else if (event.key === 'Tab') {
      this.closeAll();
    }
  }

  private closeAll(): void {
    this.container.querySelectorAll('.rly-menu-dd').forEach((p) => p.classList.remove('rly-open'));
    this.container
      .querySelectorAll('.rly-menu-btn')
      .forEach((b) => b.setAttribute('aria-expanded', 'false'));
    this.openPanel = null;
  }
}

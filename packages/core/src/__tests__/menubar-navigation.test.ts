import { afterEach, describe, expect, it, vi } from 'vitest';
import { Menubar } from '../ui/Menubar';
import type { Editor } from '../editor/Editor';

const cleanup: Array<() => void> = [];
afterEach(() => {
  cleanup.splice(0).forEach((fn) => fn());
  document.body.replaceChildren();
});
function setup() {
  const destroy: Array<() => void> = [];
  const execCommand = vi.fn(),
    focus = vi.fn();
  const editor = {
    ui: {
      menuItems: new Map([
        ['copy', { menu: 'edit', text: 'Copy', command: 'copy' }],
        ['paste', { menu: 'edit', text: 'Paste', command: 'paste' }],
        [
          'save',
          {
            menu: 'file',
            text: 'Save',
            command: 'save',
            args: { format: 'html' },
            shortcut: 'Mod+S'
          }
        ],
        ['print', { menu: 'file', text: 'Print', command: 'print' }],
        ['unknown', { menu: 'unknown', text: 'Unknown', command: 'unknown' }]
      ])
    },
    events: { on: (_: string, cb: () => void) => destroy.push(cb) },
    execCommand,
    focus
  } as unknown as Editor;
  const container = document.createElement('div');
  document.body.append(container);
  new Menubar(editor, container);
  const stop = () => destroy.splice(0).forEach((fn) => fn());
  cleanup.push(stop);
  const get = (id: string) => container.querySelector<HTMLButtonElement>(`[data-testid="${id}"]`)!;
  const key = (el: HTMLElement, value: string) => {
    const event = new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true });
    el.dispatchEvent(event);
    return event;
  };
  return { container, get, key, execCommand, focus, stop };
}
describe('menubar pointer and keyboard navigation', () => {
  it('renders supported menus in order and executes a selection-safe command', () => {
    const { container, get, execCommand, focus } = setup();
    expect([...container.querySelectorAll('.rly-menu-btn')].map((el) => el.textContent)).toEqual([
      'File',
      'Edit'
    ]);
    expect(container.querySelector('[data-testid="menuitem-unknown"]')).toBeNull();
    expect(get('menuitem-save').querySelector('.rly-kbd')?.textContent).toContain('S');
    for (const el of [get('menu-file'), get('menuitem-save')]) {
      const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
      el.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    }
    get('menu-file').click();
    expect(get('menu-file').getAttribute('aria-expanded')).toBe('true');
    get('menu-file').click();
    expect(get('menu-file').getAttribute('aria-expanded')).toBe('false');
    get('menu-edit').click();
    get('menu-file').click();
    expect(get('menu-edit').getAttribute('aria-expanded')).toBe('false');
    get('menuitem-save').click();
    expect(execCommand).toHaveBeenCalledWith('save', { format: 'html' });
    expect(focus).toHaveBeenCalledOnce();
    expect(container.querySelector('.rly-open')).toBeNull();
    get('menu-edit').click();
    document.body.click();
    expect(container.querySelector('.rly-open')).toBeNull();
  });
  it('wraps top-level navigation without opening and ignores unrelated keys', () => {
    const { get, key, container } = setup();
    key(get('menu-file'), 'ArrowLeft');
    expect(document.activeElement).toBe(get('menu-edit'));
    key(get('menu-edit'), 'ArrowRight');
    expect(document.activeElement).toBe(get('menu-file'));
    expect(container.querySelector('.rly-open')).toBeNull();
    expect(key(get('menu-file'), 'a').defaultPrevented).toBe(false);
    get('menu-file').click();
    key(get('menu-file'), 'Escape');
    expect(document.activeElement).toBe(get('menu-file'));
    expect(container.querySelector('.rly-open')).toBeNull();
  });
  it('navigates enabled items, wraps, and moves between open menus', () => {
    const { get, key, container } = setup();
    key(get('menu-file'), 'ArrowDown');
    expect(document.activeElement).toBe(get('menuitem-save'));
    key(get('menuitem-save'), 'ArrowUp');
    expect(document.activeElement).toBe(get('menuitem-print'));
    key(get('menuitem-print'), 'ArrowDown');
    expect(document.activeElement).toBe(get('menuitem-save'));
    key(get('menuitem-save'), 'End');
    expect(document.activeElement).toBe(get('menuitem-print'));
    key(get('menuitem-print'), 'Home');
    expect(document.activeElement).toBe(get('menuitem-save'));
    key(get('menuitem-save'), 'ArrowRight');
    expect(document.activeElement).toBe(get('menuitem-copy'));
    key(get('menuitem-copy'), 'ArrowLeft');
    expect(document.activeElement).toBe(get('menuitem-save'));
    expect(key(get('menuitem-save'), 'x').defaultPrevented).toBe(false);
    key(get('menuitem-save'), 'Escape');
    expect(document.activeElement).toBe(get('menu-file'));
    get('menuitem-save').disabled = true;
    key(get('menu-file'), 'ArrowDown');
    expect(document.activeElement).toBe(get('menuitem-print'));
    key(get('menuitem-print'), 'Tab');
    expect(container.querySelector('.rly-open')).toBeNull();
  });
  it('ignores unowned keyboard targets and unregisters outside-click on destroy', () => {
    const { container, get, key, stop } = setup();
    expect(key(container, 'ArrowDown').defaultPrevented).toBe(false);
    const stray = document.createElement('button');
    stray.setAttribute('role', 'menuitem');
    container.append(stray);
    expect(key(stray, 'ArrowDown').defaultPrevented).toBe(false);
    stray.className = 'rly-menu-btn';
    key(stray, 'ArrowDown');
    key(stray, 'ArrowRight');
    get('menu-file').click();
    stop();
    document.body.click();
    expect(get('menu-file').getAttribute('aria-expanded')).toBe('true');
  });
});

import { describe, it, expect, afterEach } from 'vitest';
import type { Editor } from '../editor/Editor';
import { createTestEditor, selectText, placeCursor, destroyAll } from './test-utils';

let ed: Editor;
afterEach(() => destroyAll(ed));

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe('link plugin', () => {
  it('InsertLink with args wraps the selection', () => {
    ed = createTestEditor('<p>visit the docs now</p>');
    selectText(ed, 'the docs');
    ed.execCommand('InsertLink', { href: 'https://example.com' });
    expect(ed.getContent()).toBe('<p>visit <a href="https://example.com">the docs</a> now</p>');
    expect(ed.queryCommandState('InsertLink')).toBe(true);
  });

  it('normalizes www. URLs to https', () => {
    ed = createTestEditor('<p>site</p>');
    selectText(ed, 'site');
    ed.execCommand('InsertLink', { href: 'www.example.com' });
    expect(ed.getContent()).toContain('href="https://www.example.com"');
  });

  it('editing an existing link updates the href', () => {
    ed = createTestEditor('<p><a href="https://old.com">text</a></p>');
    selectText(ed, 'text');
    ed.execCommand('InsertLink', { href: 'https://new.com' });
    expect(ed.getContent()).toBe('<p><a href="https://new.com">text</a></p>');
  });

  it('collapsed cursor inserts the URL as link text', () => {
    ed = createTestEditor('<p>x</p>');
    placeCursor(ed, 'x', 1);
    ed.execCommand('InsertLink', { href: 'https://example.com' });
    expect(ed.getContent()).toBe('<p>x<a href="https://example.com">https://example.com</a></p>');
  });

  it('Unlink removes the wrapping anchor', () => {
    ed = createTestEditor('<p>go <a href="https://x.com">there</a> now</p>');
    selectText(ed, 'there');
    ed.execCommand('Unlink');
    expect(ed.getContent()).toBe('<p>go there now</p>');
  });

  it('unlinks when browser range boundaries surround the anchor element', () => {
    ed = createTestEditor('<p>go <a href="https://x.com">there</a> now</p>');
    const p = ed.getBody().querySelector('p')!;
    const range = document.createRange();
    range.setStart(p, 1);
    range.setEnd(p, 2);
    ed.selection.setRange(range);

    expect(ed.queryCommandState('InsertLink')).toBe(true);
    ed.execCommand('Unlink');
    expect(ed.getContent()).toBe('<p>go there now</p>');
  });

  it('autolink wraps a typed URL on space', () => {
    ed = createTestEditor('<p>see https://example.com/docs</p>');
    const p = ed.getBody().querySelector('p')!;
    const textNode = p.firstChild as Text;
    const range = document.createRange();
    range.setStart(textNode, textNode.data.length);
    range.collapse(true);
    ed.selection.setRange(range);
    ed.getBody().dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(ed.getContent()).toBe(
      '<p>see <a href="https://example.com/docs">https://example.com/docs</a></p>'
    );
  });

  it('autolink does not fire inside an existing link', () => {
    ed = createTestEditor('<p><a href="https://x.com">https://x.com</a></p>');
    const a = ed.getBody().querySelector('a')!;
    const textNode = a.firstChild as Text;
    const range = document.createRange();
    range.setStart(textNode, textNode.data.length);
    range.collapse(true);
    ed.selection.setRange(range);
    ed.getBody().dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(ed.getContent()).toBe('<p><a href="https://x.com">https://x.com</a></p>');
  });
});

describe('link dialog', () => {
  it('InsertLink without args opens the dialog; submit inserts the link', async () => {
    ed = createTestEditor('<p>click me</p>');
    selectText(ed, 'click me');
    ed.execCommand('InsertLink');
    const dialog = document.querySelector<HTMLElement>('[data-testid="dialog-link"]');
    expect(dialog).toBeTruthy();

    const input = dialog!.querySelector<HTMLInputElement>('[data-testid="dialog-field-href"]')!;
    input.value = 'https://cool.dev';
    dialog!.querySelector<HTMLButtonElement>('[data-testid="dialog-submit"]')!.click();
    await tick();
    expect(ed.getContent()).toBe('<p><a href="https://cool.dev">click me</a></p>');
    expect(document.querySelector('[data-testid="dialog-link"]')).toBeNull();
  });

  it('cancel leaves content untouched', async () => {
    ed = createTestEditor('<p>plain</p>');
    selectText(ed, 'plain');
    ed.execCommand('InsertLink');
    document.querySelector<HTMLButtonElement>('[data-testid="dialog-cancel"]')!.click();
    await tick();
    expect(ed.getContent()).toBe('<p>plain</p>');
  });
});

describe('menubar', () => {
  it('renders menus for registered items with testids', () => {
    ed = createTestEditor('<p>x</p>');
    const root = ed.getRoot();
    expect(root.querySelector('[data-testid="menu-edit"]')).toBeTruthy();
    expect(root.querySelector('[data-testid="menu-format"]')).toBeTruthy();
    expect(root.querySelector('[data-testid="menu-insert"]')).toBeTruthy();
    expect(root.querySelector('[data-testid="menuitem-bold"]')).toBeTruthy();
    expect(root.querySelector('[data-testid="menuitem-link"]')).toBeTruthy();
  });

  it('clicking a menu item executes its command', () => {
    ed = createTestEditor('<p>make bold</p>');
    selectText(ed, 'bold');
    ed.getRoot().querySelector<HTMLButtonElement>('[data-testid="menuitem-bold"]')!.click();
    expect(ed.getContent()).toBe('<p>make <strong>bold</strong></p>');
  });

  it('menubar can be disabled via config', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const ed2 = createTestEditorWithoutMenubar(target);
    expect(ed2.getRoot().querySelector('.rly-menubar')).toBeNull();
    ed2.destroy();
  });
});

// Local helper (keeps test-utils API stable).
import { Editor as CoreEditor } from '../editor/Editor';
function createTestEditorWithoutMenubar(target: HTMLElement): Editor {
  return CoreEditor.init({ target, initialContent: '<p>x</p>', menubar: false });
}

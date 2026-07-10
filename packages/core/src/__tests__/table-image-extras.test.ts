import { describe, it, expect, afterEach } from 'vitest';
import type { Editor } from '../editor/Editor';
import { createTestEditor, placeCursor, destroyAll } from './test-utils';

let ed: Editor;
afterEach(() => destroyAll(ed));

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe('table plugin', () => {
  it('InsertTable builds rows × cols and leaves a trailing paragraph', () => {
    ed = createTestEditor('<p>x</p>');
    placeCursor(ed, 'x', 1);
    ed.execCommand('InsertTable', { rows: 2, cols: 3 });
    const table = ed.getBody().querySelector('table')!;
    expect(table.rows.length).toBe(2);
    expect(table.rows[0]!.cells.length).toBe(3);
    expect(table.nextElementSibling).toBeTruthy();
    expect(ed.queryCommandState('InsertTable')).toBe(true); // caret inside table
  });

  it('replaces an empty paragraph instead of appending after it', () => {
    ed = createTestEditor('<p><br></p>');
    ed.selection.selectNodeContents(ed.getBody().querySelector('p')!);
    ed.execCommand('InsertTable', { rows: 1, cols: 1 });
    expect(ed.getBody().querySelectorAll('p').length).toBe(1); // only the escape-hatch p
    expect(ed.getBody().querySelector('table')).toBeTruthy();
  });

  it('inserts and deletes rows', () => {
    ed = createTestEditor('<table><tbody><tr><td>a</td></tr></tbody></table>');
    placeCursor(ed, 'a', 0);
    ed.execCommand('TableInsertRowAfter');
    expect(ed.getBody().querySelectorAll('tr').length).toBe(2);
    ed.execCommand('TableDeleteRow'); // caret moved into the new row by insert
    expect(ed.getBody().querySelectorAll('tr').length).toBe(1);
  });

  it('inserts and deletes columns across all rows', () => {
    ed = createTestEditor('<table><tbody><tr><td>a</td></tr><tr><td>b</td></tr></tbody></table>');
    placeCursor(ed, 'a', 0);
    ed.execCommand('TableInsertColAfter');
    ed.getBody()
      .querySelectorAll('tr')
      .forEach((tr) => expect(tr.children.length).toBe(2));
    ed.execCommand('TableDeleteCol');
    ed.getBody()
      .querySelectorAll('tr')
      .forEach((tr) => expect(tr.children.length).toBe(1));
  });

  it('deleting the last row removes the table', () => {
    ed = createTestEditor('<table><tbody><tr><td>solo</td></tr></tbody></table>');
    placeCursor(ed, 'solo', 0);
    ed.execCommand('TableDeleteRow');
    expect(ed.getBody().querySelector('table')).toBeNull();
  });

  it('TableDelete removes the whole table', () => {
    ed = createTestEditor('<p>keep</p><table><tbody><tr><td>bye</td></tr></tbody></table>');
    placeCursor(ed, 'bye', 0);
    ed.execCommand('TableDelete');
    expect(ed.getContent()).toBe('<p>keep</p>');
  });

  it('Tab moves to the next cell; Tab on the last cell appends a row', () => {
    ed = createTestEditor('<table><tbody><tr><td>one</td><td>two</td></tr></tbody></table>');
    placeCursor(ed, 'one', 0);
    ed.getBody().dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    // caret should now be in "two" — verify via element path
    const range = ed.selection.getRange()!;
    expect(range.startContainer.textContent).toContain('two');

    ed.getBody().dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(ed.getBody().querySelectorAll('tr').length).toBe(2);
  });
});

describe('image plugin', () => {
  it('InsertImage with args inserts an img at the caret', () => {
    ed = createTestEditor('<p>pic here</p>');
    placeCursor(ed, 'here', 4);
    ed.execCommand('InsertImage', { src: 'https://x.com/a.png', alt: 'demo' });
    expect(ed.getContent()).toBe('<p>pic here<img src="https://x.com/a.png" alt="demo"></p>');
  });

  it('opens a dialog without args and inserts on submit', async () => {
    ed = createTestEditor('<p>x</p>');
    placeCursor(ed, 'x', 1);
    ed.execCommand('InsertImage');
    const dialog = document.querySelector<HTMLElement>('[data-testid="dialog-image"]')!;
    expect(dialog).toBeTruthy();
    dialog.querySelector<HTMLInputElement>('[data-testid="dialog-field-src"]')!.value =
      'https://x.com/b.png';
    dialog.querySelector<HTMLButtonElement>('[data-testid="dialog-submit"]')!.click();
    await tick();
    expect(ed.getContent()).toContain('<img src="https://x.com/b.png"');
  });
});

describe('hr / source code / fullscreen', () => {
  it('InsertHorizontalRule adds an hr after the current block', () => {
    ed = createTestEditor('<p>above</p>');
    placeCursor(ed, 'above', 2);
    ed.execCommand('InsertHorizontalRule');
    expect(ed.getContent()).toMatch(/<p>above<\/p><hr><p>/);
  });

  it('SourceCode dialog round-trips edited HTML through the sanitizer', async () => {
    ed = createTestEditor('<p>old</p>');
    ed.execCommand('SourceCode');
    const dialog = document.querySelector<HTMLElement>('[data-testid="dialog-code"]')!;
    const area = dialog.querySelector<HTMLTextAreaElement>('[data-testid="dialog-field-code"]')!;
    expect(area.value).toBe('<p>old</p>');
    area.value = '<h1>new</h1><script>evil()</script>';
    dialog.querySelector<HTMLButtonElement>('[data-testid="dialog-submit"]')!.click();
    await tick();
    expect(ed.getContent()).toBe('<h1>new</h1>'); // script stripped by sanitizer
  });

  it('ToggleFullscreen toggles the root class and state', () => {
    ed = createTestEditor('<p>x</p>');
    expect(ed.queryCommandState('ToggleFullscreen')).toBe(false);
    ed.execCommand('ToggleFullscreen');
    expect(ed.getRoot().classList.contains('sbe-fullscreen')).toBe(true);
    expect(ed.queryCommandState('ToggleFullscreen')).toBe(true);
    ed.execCommand('ToggleFullscreen');
    expect(ed.getRoot().classList.contains('sbe-fullscreen')).toBe(false);
  });
});

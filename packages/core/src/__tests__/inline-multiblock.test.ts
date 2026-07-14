import { afterEach, describe, expect, it } from 'vitest';
import type { Editor } from '../editor/Editor';
import { createTestEditor, destroyAll } from './test-utils';

let ed: Editor;
afterEach(() => destroyAll(ed));

/** Select from an offset in the first matching text to an offset in another. */
function selectAcross(editor: Editor, fromText: string, toText: string): void {
  const body = editor.getBody();
  const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
  let start: Text | null = null;
  let end: Text | null = null;
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const t = node as Text;
    if (!start && t.data.includes(fromText)) start = t;
    if (t.data.includes(toText)) end = t;
  }
  if (!start || !end) throw new Error('selectAcross: text not found');
  const range = document.createRange();
  range.setStart(start, start.data.indexOf(fromText));
  range.setEnd(end, end.data.indexOf(toText) + toText.length);
  editor.selection.setRange(range);
}

describe('inline formatting across block boundaries', () => {
  it('bolds each block individually instead of wrapping blocks in one <strong>', () => {
    ed = createTestEditor('<h1>Title</h1><p>Body</p>');
    selectAcross(ed, 'Title', 'Body');
    ed.execCommand('Bold');

    const html = ed.getContent();
    expect(html).toBe('<h1><strong>Title</strong></h1><p><strong>Body</strong></p>');
    // No inline element may contain a block element.
    expect(ed.getBody().querySelector('strong p, strong h1, strong li')).toBeNull();
  });

  it('bolds list items without adding a stray empty <li>', () => {
    ed = createTestEditor('<ul><li>one</li><li>two</li></ul>');
    selectAcross(ed, 'one', 'two');
    ed.execCommand('Bold');

    const html = ed.getContent();
    expect(html).toBe('<ul><li><strong>one</strong></li><li><strong>two</strong></li></ul>');
    expect(ed.getBody().querySelectorAll('li').length).toBe(2);
  });

  it('italicizes a three-block selection per block', () => {
    ed = createTestEditor('<p>a</p><p>b</p><p>c</p>');
    selectAcross(ed, 'a', 'c');
    ed.execCommand('Italic');

    expect(ed.getContent()).toBe('<p><em>a</em></p><p><em>b</em></p><p><em>c</em></p>');
  });

  it('keeps every applied inline format active in the toolbar for the same selection', () => {
    ed = createTestEditor('<p>first</p><p>second</p>');
    selectAcross(ed, 'first', 'second');
    const bold = ed.getRoot().querySelector<HTMLButtonElement>('[data-testid="tb-bold"]')!;
    const italic = ed.getRoot().querySelector<HTMLButtonElement>('[data-testid="tb-italic"]')!;

    bold.click();
    italic.click();

    expect(ed.getContent()).toBe(
      '<p><em><strong>first</strong></em></p><p><em><strong>second</strong></em></p>'
    );
    expect(bold.getAttribute('aria-pressed')).toBe('true');
    expect(italic.getAttribute('aria-pressed')).toBe('true');
  });

  it('keeps a format inactive when only some selected block slices contain it', () => {
    ed = createTestEditor('<p><strong>first</strong></p><p>second</p>');
    selectAcross(ed, 'first', 'second');

    expect(ed.queryCommandState('Bold')).toBe(false);
  });

  it('toggles bold off across blocks when every block is already bold', () => {
    ed = createTestEditor('<p><strong>a</strong></p><p><strong>b</strong></p>');
    selectAcross(ed, 'a', 'b');
    ed.execCommand('Bold');

    expect(ed.getContent()).toBe('<p>a</p><p>b</p>');
  });

  it('leaves single-block bold behavior unchanged', () => {
    ed = createTestEditor('<p>hello world</p>');
    selectAcross(ed, 'hello', 'hello');
    ed.execCommand('Bold');
    expect(ed.getContent()).toBe('<p><strong>hello</strong> world</p>');
  });

  it('links each block separately instead of wrapping blocks in one <a>', () => {
    ed = createTestEditor('<p>one</p><p>two</p>');
    selectAcross(ed, 'one', 'two');
    ed.execCommand('InsertLink', { href: 'https://example.com' });

    const html = ed.getContent();
    expect(html).toBe(
      '<p><a href="https://example.com">one</a></p><p><a href="https://example.com">two</a></p>'
    );
    expect(ed.getBody().querySelector('a p, a h1, a li')).toBeNull();
  });

  it('applies a color per block (styled-span path stays structural)', () => {
    ed = createTestEditor('<p>one</p><p>two</p>');
    selectAcross(ed, 'one', 'two');
    ed.execCommand('ForeColor', '#e5484d');

    // No inline <span> may contain a block element.
    expect(ed.getBody().querySelector('span p, span h1, span li')).toBeNull();
    const spans = ed.getBody().querySelectorAll('p > span[style*="color"]');
    expect(spans.length).toBe(2);
  });
});

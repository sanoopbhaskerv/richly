import { describe, it, expect, afterEach } from 'vitest';
import type { Editor } from '../editor/Editor';
import { createTestEditor, selectText, destroyAll } from './test-utils';

let ed: Editor;
afterEach(() => destroyAll(ed));

describe('inline format commands', () => {
  it('Bold wraps the selection in <strong>', () => {
    ed = createTestEditor('<p>hello world</p>');
    selectText(ed, 'hello');
    ed.execCommand('Bold');
    expect(ed.getContent()).toBe('<p><strong>hello</strong> world</p>');
  });

  it('Bold toggles off when selection is fully bold', () => {
    ed = createTestEditor('<p><strong>hello</strong> world</p>');
    selectText(ed, 'hello');
    ed.execCommand('Bold');
    expect(ed.getContent()).toBe('<p>hello world</p>');
  });

  it('toggles off when browser range boundaries surround the strong element', () => {
    ed = createTestEditor('<p><strong>hello</strong> world</p>');
    const p = ed.getBody().querySelector('p')!;
    const range = document.createRange();
    range.setStart(p, 0);
    range.setEnd(p, 1);
    ed.selection.setRange(range);

    expect(ed.queryCommandState('Bold')).toBe(true);
    ed.execCommand('Bold');
    expect(ed.getContent()).toBe('<p>hello world</p>');
    expect(ed.queryCommandState('Bold')).toBe(false);
  });

  it('un-bolding the middle of a bold run splits it', () => {
    ed = createTestEditor('<p><strong>aaa bbb ccc</strong></p>');
    selectText(ed, 'bbb');
    ed.execCommand('Bold');
    expect(ed.getContent()).toBe('<p><strong>aaa </strong>bbb<strong> ccc</strong></p>');
  });

  it('Italic uses <em>; nesting formats works', () => {
    ed = createTestEditor('<p>hello world</p>');
    selectText(ed, 'hello');
    ed.execCommand('Bold');
    selectText(ed, 'hello');
    ed.execCommand('Italic');
    const html = ed.getContent();
    expect(html).toContain('hello');
    expect(html).toMatch(/<em><strong>|<strong><em>/);
  });

  it('queryCommandState reflects cursor formatting', () => {
    ed = createTestEditor('<p><strong>bold</strong> plain</p>');
    selectText(ed, 'bold');
    expect(ed.queryCommandState('Bold')).toBe(true);
    selectText(ed, 'plain');
    expect(ed.queryCommandState('Bold')).toBe(false);
  });

  it('RemoveFormat strips all inline formatting', () => {
    ed = createTestEditor('<p><strong><em>styled</em></strong> text</p>');
    selectText(ed, 'styled');
    ed.execCommand('RemoveFormat');
    expect(ed.getContent()).toBe('<p>styled text</p>');
  });

  it('collapsed selection is a no-op (v0)', () => {
    ed = createTestEditor('<p>hello</p>');
    selectText(ed, 'hello');
    ed.selection.getRange()!.collapse(true);
    ed.execCommand('Bold');
    expect(ed.getContent()).toBe('<p>hello</p>');
  });
});

describe('block commands', () => {
  it('FormatBlock converts p to h1', () => {
    ed = createTestEditor('<p>title</p>');
    selectText(ed, 'title');
    ed.execCommand('FormatBlock', 'h1');
    expect(ed.getContent()).toBe('<h1>title</h1>');
  });

  it('FormatBlock preserves inline children', () => {
    ed = createTestEditor('<p>a <strong>b</strong> c</p>');
    selectText(ed, 'a');
    ed.execCommand('FormatBlock', 'blockquote');
    expect(ed.getContent()).toBe('<blockquote>a <strong>b</strong> c</blockquote>');
  });

  it('block toggle state tracks cursor position', () => {
    ed = createTestEditor('<h1>title</h1><p>body</p>');
    selectText(ed, 'title');
    expect(ed.queryCommandState('FormatBlock:h1')).toBe(true);
    expect(ed.queryCommandState('FormatBlock:p')).toBe(false);
    selectText(ed, 'body');
    expect(ed.queryCommandState('FormatBlock:p')).toBe(true);
  });
});

import { describe, it, expect, afterEach } from 'vitest';
import type { Editor } from '../editor/Editor';
import { createTestEditor, selectText, destroyAll } from './test-utils';
import { applyStyledSpan, removeStyledSpan, queryStyledValue } from '../dom/DomUtils';

let ed: Editor;
afterEach(() => destroyAll(ed));

function normalizeHtml(html: string): string {
  return html.replace(/style="([^"]+)"/g, (match, styleStr) => {
    const rules = styleStr
      .split(';')
      // Explicitly type 'r' as string to satisfy the compiler under strict implicit any rules.
      .map((r: string) => r.trim())
      .filter(Boolean);
    rules.sort();
    return `style="${rules.join('; ')}"`;
  });
}

describe('Styled-span engine', () => {
  it('applyStyledSpan wraps text in a style span', () => {
    ed = createTestEditor('<p>hello world</p>');
    selectText(ed, 'hello');
    const range = ed.selection.getRange()!;
    applyStyledSpan(range, 'color', 'red', ed.getBody());
    expect(normalizeHtml(ed.getContent())).toBe(
      normalizeHtml('<p><span style="color: red">hello</span> world</p>')
    );
  });

  it('re-applying same style replaces value without nesting', () => {
    ed = createTestEditor('<p><span style="color: red">hello</span> world</p>');
    selectText(ed, 'hello');
    const range = ed.selection.getRange()!;
    applyStyledSpan(range, 'color', 'blue', ed.getBody());
    expect(normalizeHtml(ed.getContent())).toBe(
      normalizeHtml('<p><span style="color: blue">hello</span> world</p>')
    );
  });

  it('re-coloring subrange splits the styled span', () => {
    ed = createTestEditor('<p><span style="color: red">aabbcc</span></p>');
    selectText(ed, 'bb');
    const range = ed.selection.getRange()!;
    applyStyledSpan(range, 'color', 'blue', ed.getBody());
    expect(normalizeHtml(ed.getContent())).toBe(
      normalizeHtml(
        '<p><span style="color: red">aa</span><span style="color: blue">bb</span><span style="color: red">cc</span></p>'
      )
    );
  });

  it('applying different property to coincident range merges them', () => {
    ed = createTestEditor('<p><span style="color: red">hello</span> world</p>');
    selectText(ed, 'hello');
    const range = ed.selection.getRange()!;
    applyStyledSpan(range, 'font-size', '18px', ed.getBody());
    expect(normalizeHtml(ed.getContent())).toBe(
      normalizeHtml('<p><span style="color: red; font-size: 18px">hello</span> world</p>')
    );
  });

  it('removeStyledSpan removes property and unwraps if empty', () => {
    ed = createTestEditor('<p><span style="color: red">hello</span> world</p>');
    selectText(ed, 'hello');
    const range = ed.selection.getRange()!;
    removeStyledSpan(range, 'color', ed.getBody());
    expect(normalizeHtml(ed.getContent())).toBe(normalizeHtml('<p>hello world</p>'));
  });

  it('removeStyledSpan removes property and preserves other styles', () => {
    ed = createTestEditor('<p><span style="color: red; font-size: 18px">hello</span> world</p>');
    selectText(ed, 'hello');
    const range = ed.selection.getRange()!;
    removeStyledSpan(range, 'color', ed.getBody());
    expect(normalizeHtml(ed.getContent())).toBe(
      normalizeHtml('<p><span style="font-size: 18px">hello</span> world</p>')
    );
  });

  it('removeStyledSpan splits subrange of multiple styles correctly', () => {
    ed = createTestEditor('<p><span style="color: red; font-size: 18px">aabbcc</span></p>');
    selectText(ed, 'bb');
    const range = ed.selection.getRange()!;
    removeStyledSpan(range, 'color', ed.getBody());
    const content = normalizeHtml(ed.getContent());
    expect(content).toContain(normalizeHtml('<span style="color: red; font-size: 18px">aa</span>'));
    expect(content).toContain(normalizeHtml('<span style="font-size: 18px">bb</span>'));
    expect(content).toContain(normalizeHtml('<span style="color: red; font-size: 18px">cc</span>'));
  });

  it('merges adjacent styled spans with identical styles', () => {
    ed = createTestEditor(
      '<p><span style="color: red">hello</span><span style="color: red">world</span></p>'
    );
    const body = ed.getBody();
    const p = body.querySelector('p')!;
    const range = document.createRange();
    range.setStart(p.firstChild!, 0);
    range.setEnd(p.lastChild!, 1);
    ed.selection.setRange(range);
    applyStyledSpan(range, 'color', 'red', body);
    expect(normalizeHtml(ed.getContent())).toBe(
      normalizeHtml('<p><span style="color: red">helloworld</span></p>')
    );
  });

  it('compares complete style sets independently of declaration order', () => {
    ed = createTestEditor(
      '<p><span style="color: red; font-size: 18px">a</span><span style="font-size: 18px; color: red">b</span></p>'
    );
    const paragraph = ed.getBody().querySelector('p')!;
    const range = document.createRange();
    range.selectNodeContents(paragraph);

    const out = applyStyledSpan(range, 'color', 'red', ed.getBody());

    expect(normalizeHtml(ed.getContent())).toBe(
      normalizeHtml('<p><span style="color: red; font-size: 18px">ab</span></p>')
    );
    expect(out.startContainer.isConnected).toBe(true);
  });

  it('merges across empty range boundary nodes and returns a connected range', () => {
    ed = createTestEditor('<p><span style="color: red">a</span>b</p>');
    selectText(ed, 'b');

    const out = applyStyledSpan(ed.selection.getRange()!, 'color', 'red', ed.getBody());

    expect(normalizeHtml(ed.getContent())).toBe(
      normalizeHtml('<p><span style="color: red">ab</span></p>')
    );
    expect(out.startContainer.isConnected).toBe(true);
    expect(out.toString()).toBe('ab');
  });

  it('queryStyledValue returns nearest inline-style value', () => {
    ed = createTestEditor('<p><span style="color: red"><strong>hello</strong></span></p>');
    const strong = ed.getBody().querySelector('strong')!;
    expect(queryStyledValue(strong, 'color', ed.getBody())).toBe('red');
    expect(queryStyledValue(strong, 'font-size', ed.getBody())).toBe('');
  });
});

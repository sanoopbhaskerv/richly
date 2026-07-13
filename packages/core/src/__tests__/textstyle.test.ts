import { describe, it, expect, afterEach } from 'vitest';
import { createTestEditor, selectText, destroyAll } from './test-utils';
import { Editor } from '../editor/Editor';

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

describe('Text Style Commands & Queries', () => {
  // --- 1. Plain apply & re-apply ---
  it('ForeColor, BackColor, and FontSize commands apply styles on range', () => {
    ed = createTestEditor('<p>hello world</p>');
    selectText(ed, 'hello');

    ed.execCommand('ForeColor', 'red');
    expect(normalizeHtml(ed.getContent())).toBe(
      normalizeHtml('<p><span style="color: red">hello</span> world</p>')
    );

    ed.execCommand('FontSize', '18px');
    expect(normalizeHtml(ed.getContent())).toBe(
      normalizeHtml('<p><span style="color: red; font-size: 18px">hello</span> world</p>')
    );
  });

  it('re-applying ForeColor / FontSize replaces the style instead of nesting spans', () => {
    ed = createTestEditor('<p><span style="color: red">hello</span> world</p>');
    selectText(ed, 'hello');

    ed.execCommand('ForeColor', 'blue');
    expect(normalizeHtml(ed.getContent())).toBe(
      normalizeHtml('<p><span style="color: blue">hello</span> world</p>')
    );
  });

  // --- 2. Subrange modifications ---
  it('re-coloring / sizing a subrange splits the styled span', () => {
    ed = createTestEditor('<p><span style="color: red">aabbcc</span></p>');
    selectText(ed, 'bb');

    ed.execCommand('ForeColor', 'blue');
    expect(normalizeHtml(ed.getContent())).toBe(
      normalizeHtml(
        '<p><span style="color: red">aa</span><span style="color: blue">bb</span><span style="color: red">cc</span></p>'
      )
    );
  });

  // --- 3. Coinciding styles ---
  it('applying multiple styles to a coincident range merges them into a single span', () => {
    ed = createTestEditor('<p>hello world</p>');
    selectText(ed, 'hello');

    ed.execCommand('ForeColor', 'red');
    ed.execCommand('BackColor', 'blue');
    ed.execCommand('FontSize', '24px');
    expect(normalizeHtml(ed.getContent())).toBe(
      normalizeHtml(
        '<p><span style="color: red; background-color: blue; font-size: 24px">hello</span> world</p>'
      )
    );
  });

  // --- 4. Remove styles ---
  it('executing ForeColor/BackColor/FontSize with empty string removes style property', () => {
    ed = createTestEditor('<p><span style="color: red; font-size: 18px">hello</span> world</p>');
    selectText(ed, 'hello');

    ed.execCommand('ForeColor', '');
    expect(normalizeHtml(ed.getContent())).toBe(
      normalizeHtml('<p><span style="font-size: 18px">hello</span> world</p>')
    );

    ed.execCommand('FontSize', '');
    expect(normalizeHtml(ed.getContent())).toBe(normalizeHtml('<p>hello world</p>'));
  });

  // --- 5. Sibling merging ---
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

    ed.execCommand('ForeColor', 'red');
    expect(normalizeHtml(ed.getContent())).toBe(
      normalizeHtml('<p><span style="color: red">helloworld</span></p>')
    );
  });

  // --- 6. No-op range guard ---
  it('commands immediately no-op if there is no active selection range', () => {
    ed = createTestEditor('<p>hello world</p>');
    // Remove selection range
    ed.getBody().ownerDocument.getSelection()?.removeAllRanges();

    const originalContent = ed.getContent();
    ed.execCommand('ForeColor', 'red');
    ed.execCommand('FontSize', '24px');
    ed.execCommand('Superscript');
    ed.execCommand('Subscript');

    expect(ed.getContent()).toBe(originalContent);
  });

  // --- 7. Caret container behavior ---
  it('applies pending style then types correctly at a collapsed cursor', () => {
    ed = createTestEditor('<p>hello </p>');
    const p = ed.getBody().querySelector('p')!;
    const range = ed.getBody().ownerDocument.createRange();
    // Collapse range at the end of the text node
    range.setStart(p.firstChild!, p.firstChild!.textContent!.length);
    range.collapse(true);
    ed.selection.setRange(range);

    ed.execCommand('ForeColor', 'red');

    // Keystroke simulation: insert a letter 'a' where the cursor is
    const activeRange = ed.selection.getRange()!;
    const textNode = activeRange.startContainer as Text;
    expect(textNode.textContent).toContain('\uFEFF');

    // Simulate user typing: insert 'a' next to U+FEFF filler
    const offset = activeRange.startOffset;
    textNode.insertData(offset, 'a');

    // Manually run editor's typing cleanup pass
    // (the editor event listener normally does this automatically on input event)
    ed.execCommand('Bold'); // dummy call or cleanCaretFiller to clean U+FEFF

    // We expect the resulting content to wrap 'a' in a style span.
    // (getContent removes U+FEFF automatically)
    expect(normalizeHtml(ed.getContent())).toBe(
      normalizeHtml('<p>hello <span style="color: red">a</span></p>')
    );
  });

  it('unwraps a styled caret container after its typed text is deleted', () => {
    ed = createTestEditor('<p>x</p>');
    const text = ed.getBody().querySelector('p')!.firstChild as Text;
    const range = document.createRange();
    range.setStart(text, 1);
    range.collapse(true);
    ed.selection.setRange(range);
    ed.execCommand('ForeColor', 'red');

    let caret = ed.selection.getRange()!;
    const styledText = caret.startContainer as Text;
    styledText.insertData(caret.startOffset, 'a');
    caret.setStart(styledText, caret.startOffset + 1);
    caret.collapse(true);
    ed.selection.setRange(caret);
    ed.getBody().dispatchEvent(new InputEvent('input'));

    styledText.deleteData(0, styledText.length);
    caret = document.createRange();
    caret.setStart(styledText, 0);
    caret.collapse(true);
    ed.selection.setRange(caret);
    ed.getBody().dispatchEvent(new InputEvent('input'));

    expect(ed.getBody().innerHTML).toBe('<p>x</p>');
    expect(ed.queryCommandState('ForeColor')).toBe(false);
  });

  it('recolors a collapsed caret without nesting spans and preserves other styles', () => {
    ed = createTestEditor('<p><span style="color: red; font-size: 18px">abcd</span></p>');
    const text = ed.getBody().querySelector('span')!.firstChild as Text;
    const range = document.createRange();
    range.setStart(text, 2);
    range.collapse(true);
    ed.selection.setRange(range);

    ed.execCommand('ForeColor', 'blue');
    const caret = ed.selection.getRange()!;
    const pendingText = caret.startContainer as Text;
    pendingText.insertData(caret.startOffset, 'x');
    caret.setStart(pendingText, caret.startOffset + 1);
    caret.collapse(true);
    ed.selection.setRange(caret);
    ed.getBody().dispatchEvent(new InputEvent('input'));

    const content = normalizeHtml(ed.getContent());
    expect(content).toContain(normalizeHtml('style="color: blue; font-size: 18px"'));
    expect(content).not.toMatch(/<span[^>]*>[^<]*<span/i);
  });

  it('queries style values when selection boundaries surround the styled element', () => {
    ed = createTestEditor('<p>plain <span style="color: red">styled</span></p>');
    const span = ed.getBody().querySelector('span')!;
    const range = document.createRange();
    range.selectNode(span);
    ed.selection.setRange(range);

    expect(ed.queryCommandValue('ForeColor')).toMatch(/^(red|rgb\(255,\s*0,\s*0\))$/i);
  });

  it('updates toolbar color indicators and marks the selected palette swatch', () => {
    ed = createTestEditor('<p>plain <span style="color: #ef4444">red</span></p>');
    selectText(ed, 'red');
    ed.events.emit('selectionchange', undefined);

    const button = ed.getRoot().querySelector<HTMLElement>('[data-testid="tb-forecolor"]')!;
    expect(button.style.getPropertyValue('--rly-control-value')).toMatch(
      /^(#ef4444|rgb\(239,\s*68,\s*68\))$/i
    );

    button.click();
    const selected = ed.getRoot().querySelector<HTMLElement>('[data-testid="swatch-ef4444"]')!;
    expect(selected.classList.contains('rly-selected')).toBe(true);
    expect(selected.getAttribute('aria-selected')).toBe('true');

    selectText(ed, 'plain');
    ed.events.emit('selectionchange', undefined);
    expect(button.style.getPropertyValue('--rly-control-value')).toBe('');
  });

  it('applies advanced custom colors and tracks recent and cleared states', () => {
    ed = createTestEditor('<p>plain custom</p>');
    selectText(ed, 'custom');

    const button = ed.getRoot().querySelector<HTMLButtonElement>('[data-testid="tb-forecolor"]')!;
    button.click();

    const custom = ed.getRoot().querySelector<HTMLButtonElement>('[data-testid="custom-color"]')!;
    const picker = custom.closest<HTMLElement>('.rly-color-picker')!;
    custom.click();
    expect(picker.dataset.view).toBe('custom');
    const customInput = picker.querySelector<HTMLInputElement>('[data-testid="color-picker-hex"]')!;
    customInput.value = '#123456';
    customInput.dispatchEvent(new Event('input', { bubbles: true }));
    picker.querySelector<HTMLButtonElement>('[data-testid="color-picker-done"]')!.click();

    expect(ed.getContent()).toMatch(/color:\s*(#123456|rgb\(18,\s*52,\s*86\))/i);
    expect(button.style.getPropertyValue('--rly-control-value')).toMatch(
      /^(#123456|rgb\(18,\s*52,\s*86\))$/i
    );

    selectText(ed, 'custom');
    ed.events.emit('selectionchange', undefined);
    button.click();
    expect(ed.getRoot().querySelector('[data-testid="recent-color-123456"]')).not.toBeNull();
    expect(ed.getRoot().querySelector('[data-testid="custom-color"]')?.textContent).toContain(
      '#123456'
    );

    button.click();
    selectText(ed, 'plain');
    ed.events.emit('selectionchange', undefined);
    button.click();
    const clear = ed.getRoot().querySelector<HTMLElement>('[data-testid="swatch-none"]')!;
    expect(clear.classList.contains('rly-selected')).toBe(true);
    expect(clear.getAttribute('aria-selected')).toBe('true');
  });

  it('cancels an advanced custom color without changing content', () => {
    ed = createTestEditor('<p>plain custom</p>');
    selectText(ed, 'custom');
    let changes = 0;
    ed.events.on('change', () => changes++);

    ed.getRoot().querySelector<HTMLButtonElement>('[data-testid="tb-backcolor"]')!.click();
    ed.getRoot()
      .querySelector<HTMLButtonElement>(
        '[data-testid="dd-backcolor"] [data-testid="custom-color"]'
      )!
      .click();

    const picker = ed
      .getRoot()
      .querySelector<HTMLElement>('.rly-color-picker[data-view="custom"]')!;
    const input = picker.querySelector<HTMLInputElement>('[data-testid="color-picker-hex"]')!;
    input.value = '#fedcba';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    picker.querySelector<HTMLButtonElement>('[data-testid="color-picker-cancel"]')!.click();

    expect(ed.getContent()).toBe('<p>plain custom</p>');
    expect(changes).toBe(0);
  });

  it('applies opacity as one undoable custom-color change', () => {
    ed = createTestEditor('<p>alpha target</p>');
    selectText(ed, 'target');
    let changes = 0;
    ed.events.on('change', () => changes++);

    ed.getRoot().querySelector<HTMLButtonElement>('[data-testid="tb-forecolor"]')!.click();
    ed.getRoot().querySelector<HTMLButtonElement>('[data-testid="custom-color"]')!.click();
    const picker = ed
      .getRoot()
      .querySelector<HTMLElement>('.rly-color-picker[data-view="custom"]')!;
    const opacity = picker.querySelector<HTMLInputElement>('[data-testid="color-picker-opacity"]')!;
    opacity.value = '50';
    opacity.dispatchEvent(new Event('input', { bubbles: true }));
    expect(
      picker.querySelector<HTMLInputElement>('[data-testid="color-picker-hex"]')!.value
    ).toMatch(/^#[0-9A-F]{6}80$/);
    picker.querySelector<HTMLButtonElement>('[data-testid="color-picker-done"]')!.click();

    expect(changes).toBe(1);
    expect(ed.getContent()).toMatch(/color:\s*(#[0-9a-f]{8}|rgba\()/i);
    ed.execCommand('Undo');
    expect(ed.getContent()).toBe('<p>alpha target</p>');
  });

  it('honors custom font-size presets verbatim', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    ed = Editor.init({
      target,
      initialContent: '<p>custom</p>',
      textStyles: { fontSizes: ['1.2em'] }
    });

    const select = ed
      .getRoot()
      .querySelector<HTMLSelectElement>('[data-testid="tb-select-fontsize"]')!;
    expect(Array.from(select.options).map((option) => option.value)).toEqual(['', '1.2em']);
    selectText(ed, 'custom');
    ed.execCommand('FontSize', '1.2em');
    expect(ed.getContent()).toContain('font-size: 1.2em');
  });

  // --- 8. Undo/Redo tests ---
  it('correctly tracks undo and redo steps for style command changes', () => {
    ed = createTestEditor('<p>hello world</p>');
    selectText(ed, 'hello');

    ed.execCommand('ForeColor', 'red');
    expect(normalizeHtml(ed.getContent())).toBe(
      normalizeHtml('<p><span style="color: red">hello</span> world</p>')
    );

    // Undo should restore plain text
    ed.execCommand('Undo');
    expect(normalizeHtml(ed.getContent())).toBe(normalizeHtml('<p>hello world</p>'));

    // Redo should restore styled text
    ed.execCommand('Redo');
    expect(normalizeHtml(ed.getContent())).toBe(
      normalizeHtml('<p><span style="color: red">hello</span> world</p>')
    );
  });

  // --- 9. Query value tests ---
  it('correctly resolves queryCommandValue and queryCommandState at different positions', () => {
    ed = createTestEditor('<p>hello <span style="color: red; font-size: 18px">world</span></p>');

    // 1. Selection in plain text
    selectText(ed, 'hello');
    expect(ed.queryCommandState('ForeColor')).toBe(false);
    expect(ed.queryCommandValue('ForeColor')).toBe('');
    expect(ed.queryCommandValue('FontSize')).toBe('');

    // 2. Selection in styled text
    selectText(ed, 'world');
    // Browser might return 'red' or 'rgb(255, 0, 0)'
    expect(ed.queryCommandState('ForeColor')).toBe(true);
    expect(ed.queryCommandValue('ForeColor')).toMatch(/^(red|rgb\(255,\s*0,\s*0\)|#ff0000)$/i);
    expect(ed.queryCommandValue('FontSize')).toBe('18px');
  });

  // --- 10. Superscript & Subscript Mutual Exclusion ---
  it('Superscript and Subscript commands toggle formatting and mutually exclude each other', () => {
    ed = createTestEditor('<p>hello world</p>');
    selectText(ed, 'hello');

    // Apply Superscript
    ed.execCommand('Superscript');
    expect(normalizeHtml(ed.getContent())).toBe(normalizeHtml('<p><sup>hello</sup> world</p>'));
    expect(ed.queryCommandState('Superscript')).toBe(true);
    expect(ed.queryCommandState('Subscript')).toBe(false);

    // Apply Subscript on same selection - should remove Superscript and apply Subscript
    ed.execCommand('Subscript');
    expect(normalizeHtml(ed.getContent())).toBe(normalizeHtml('<p><sub>hello</sub> world</p>'));
    expect(ed.queryCommandState('Superscript')).toBe(false);
    expect(ed.queryCommandState('Subscript')).toBe(true);

    // Toggle Subscript off
    ed.execCommand('Subscript');
    expect(normalizeHtml(ed.getContent())).toBe(normalizeHtml('<p>hello world</p>'));
  });

  it('Superscript and Subscript work at collapsed range caret containers and mutually exclude each other', () => {
    ed = createTestEditor('<p>hello</p>');
    const p = ed.getBody().querySelector('p')!;
    const range = ed.getBody().ownerDocument.createRange();
    range.setStart(p.firstChild!, p.firstChild!.textContent!.length);
    range.collapse(true);
    ed.selection.setRange(range);

    ed.execCommand('Superscript');
    expect(ed.queryCommandState('Superscript')).toBe(true);

    ed.execCommand('Subscript');
    expect(ed.queryCommandState('Superscript')).toBe(false);
    expect(ed.queryCommandState('Subscript')).toBe(true);
  });
});

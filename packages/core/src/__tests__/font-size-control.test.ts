import { afterEach, describe, expect, it } from 'vitest';
import {
  createFontSizeControl,
  formatFontSizeValue,
  getReferenceFontSize,
  parseFontSizeInput
} from '../ui/FontSizeControl';
import type { Editor } from '../editor/Editor';
import { createTestEditor, destroyAll, selectText } from './test-utils';

let editor: Editor | null = null;

afterEach(() => {
  if (editor) destroyAll(editor);
  editor = null;
});

function controlParts(ed: Editor): {
  input: HTMLInputElement;
  decrease: HTMLButtonElement;
  increase: HTMLButtonElement;
} {
  const root = ed.getRoot();
  return {
    input: root.querySelector<HTMLInputElement>('[data-testid="font-size-input"]')!,
    decrease: root.querySelector<HTMLButtonElement>('[data-testid="font-size-decrease"]')!,
    increase: root.querySelector<HTMLButtonElement>('[data-testid="font-size-increase"]')!
  };
}

function refreshSelection(ed: Editor): void {
  ed.events.emit('selectionchange', undefined);
}

function typeDraft(input: HTMLInputElement, value: string): void {
  input.focus();
  input.value = value;
  input.dispatchEvent(new InputEvent('input', { bubbles: true }));
}

function press(input: HTMLInputElement, key: string, shiftKey = false): void {
  input.dispatchEvent(
    new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true })
  );
}

describe('font-size value utilities', () => {
  it.each([
    ['16', 16],
    ['16px', 16],
    [' 16 px ', 16],
    ['12.5', 12.5],
    ['1', 1],
    ['512', 512]
  ])('parses %s', (input, expected) => {
    expect(parseFontSizeInput(input)).toBe(expected);
  });

  it.each(['', '0', '-1', '513', 'abc', '12.345', '16pt'])('rejects %s', (input) => {
    expect(parseFontSizeInput(input)).toBeNull();
  });

  it('formats integer and decimal values without trailing zeroes', () => {
    expect(formatFontSizeValue(16)).toBe('16');
    expect(formatFontSizeValue(12.5)).toBe('12.5');
    expect(formatFontSizeValue(12.345)).toBe('12.35');
  });
});

describe('font-size reference resolution', () => {
  it('uses the first editable text size when the editor has no selection', () => {
    editor = createTestEditor(
      '\n  <h1 style="font-size: 29.45px">Heading</h1>\n  <p style="font-size: 15.5px">Body</p>'
    );
    editor.getBody().ownerDocument.getSelection()?.removeAllRanges();

    expect(getReferenceFontSize(editor)).toBe(29.45);
    expect(controlParts(editor).input.value).toBe('29.45');
  });

  it('uses the first selected text size for forward and reverse selections', () => {
    editor = createTestEditor(
      '<p><span style="font-size: 19px">first</span><span style="font-size: 14px">last</span></p>'
    );
    const spans = editor.getBody().querySelectorAll('span');
    const first = spans[0]!.firstChild as Text;
    const last = spans[1]!.firstChild as Text;
    const selection = editor.getBody().ownerDocument.getSelection()!;

    selection.setBaseAndExtent(first, 0, last, last.length);
    expect(getReferenceFontSize(editor)).toBe(19);

    selection.setBaseAndExtent(last, last.length, first, 0);
    expect(getReferenceFontSize(editor)).toBe(19);
  });

  it('finds the first text when a selection starts at an element boundary', () => {
    editor = createTestEditor(
      '<p><span style="font-size: 21px">first</span><span style="font-size: 13px">last</span></p>'
    );
    const paragraph = editor.getBody().querySelector('p')!;
    const range = document.createRange();
    range.setStart(paragraph, 0);
    range.setEnd(paragraph, paragraph.childNodes.length);
    editor.selection.setRange(range);

    expect(getReferenceFontSize(editor)).toBe(21);
  });

  it('uses the preceding text run when a collapsed element-boundary caret is at the end', () => {
    editor = createTestEditor(
      '<p><span style="font-size: 12px">first</span><span style="font-size: 24px">last</span></p>'
    );
    const paragraph = editor.getBody().querySelector('p')!;
    const range = document.createRange();
    range.setStart(paragraph, paragraph.childNodes.length);
    range.collapse(true);
    editor.selection.setRange(range);

    expect(getReferenceFontSize(editor)).toBe(24);
  });

  it('uses the configured fallback for an empty editor', () => {
    editor = createTestEditor('<p><br></p>');
    expect(getReferenceFontSize(editor, 17)).toBe(17);
  });
});

describe('font-size toolbar control', () => {
  it('increments from the same first-text reference before the editor has been focused', () => {
    editor = createTestEditor(
      '\n  <h1 style="font-size: 29.45px">Heading</h1>\n  <p style="font-size: 15.5px">Body</p>'
    );
    editor.getBody().ownerDocument.getSelection()?.removeAllRanges();
    editor.events.emit('change', editor.getContent());
    const { input, increase } = controlParts(editor);

    expect(input.value).toBe('29.45');
    increase.click();

    expect(input.value).toBe('30.45');
    expect(editor.queryCommandValue('FontSize')).toBe('30.45px');
    expect(editor.getBody().innerHTML).toMatch(/font-size:\s*30\.45px/);
  });

  it('renders the accessible stepper instead of the preset select', () => {
    editor = createTestEditor('<p>text</p>');
    const root = editor.getRoot();

    expect(root.querySelector('[data-testid="tb-select-fontsize"]')).toBeNull();
    expect(root.querySelector('[data-testid="font-size-control"]')?.getAttribute('role')).toBe(
      'group'
    );
    expect(controlParts(editor).input.value).toBe('16');
  });

  it('applies a typed decimal on Enter as one undoable command', () => {
    editor = createTestEditor('<p>hello world</p>');
    selectText(editor, 'hello');
    refreshSelection(editor);
    const { input } = controlParts(editor);

    typeDraft(input, '23.5px');
    press(input, 'Enter');

    expect(editor.getContent()).toContain('font-size: 23.5px');
    editor.execCommand('Undo');
    expect(editor.getContent()).toBe('<p>hello world</p>');
    editor.execCommand('Redo');
    expect(editor.getContent()).toContain('font-size: 23.5px');
  });

  it('applies plus and minus from the displayed first-selection size to the whole range', () => {
    editor = createTestEditor(
      '<p><span style="font-size: 19px">one</span><span style="font-size: 16px">two</span><span style="font-size: 14px">three</span></p>'
    );
    const spans = editor.getBody().querySelectorAll('span');
    const range = document.createRange();
    range.setStart(spans[0]!.firstChild!, 0);
    range.setEnd(spans[2]!.firstChild!, 5);
    editor.selection.setRange(range);
    refreshSelection(editor);
    const { input, increase } = controlParts(editor);

    expect(input.value).toBe('19');
    increase.click();
    expect(editor.getContent()).not.toMatch(/font-size:\s*(19|16|14)px/);
    expect(editor.getContent()).toMatch(/font-size:\s*20px/);
    expect(editor.getBody().querySelector('span:empty')).toBeNull();

    refreshSelection(editor);
    controlParts(editor).decrease.click();
    expect(editor.getContent()).toMatch(/font-size:\s*19px/);
  });

  it('clears only font size and preserves unrelated inline formatting', () => {
    editor = createTestEditor(
      '<p><strong><span style="font-size: 23px; color: red">hello</span></strong> world</p>'
    );
    selectText(editor, 'hello');
    refreshSelection(editor);
    const { input } = controlParts(editor);

    typeDraft(input, '');
    press(input, 'Enter');

    expect(editor.getContent()).toMatch(
      /<strong><span style="color:\s*red;?">hello<\/span><\/strong>/
    );
    expect(editor.getContent()).not.toContain('font-size');
  });

  it('rejects invalid input without changing content or undo history', () => {
    editor = createTestEditor('<p>hello</p>');
    selectText(editor, 'hello');
    refreshSelection(editor);
    const { input } = controlParts(editor);
    const before = editor.getContent();

    typeDraft(input, '513');
    press(input, 'Enter');

    expect(editor.getContent()).toBe(before);
    expect(editor.undoManager.canUndo()).toBe(false);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBeTruthy();
  });

  it('applies valid and empty drafts on blur and restores an invalid draft', () => {
    editor = createTestEditor('<p><span style="font-size: 18px">hello</span></p>');
    selectText(editor, 'hello');
    refreshSelection(editor);
    const { input } = controlParts(editor);

    typeDraft(input, '22');
    input.blur();
    expect(editor.getContent()).toContain('font-size: 22px');

    selectText(editor, 'hello');
    refreshSelection(editor);
    typeDraft(input, '700');
    input.blur();
    expect(editor.getContent()).toContain('font-size: 22px');
    expect(input.value).toBe('22');
    expect(input.getAttribute('aria-invalid')).toBe('true');

    selectText(editor, 'hello');
    refreshSelection(editor);
    typeDraft(input, '');
    input.blur();
    expect(editor.getContent()).not.toContain('font-size');
  });

  it('ignores Enter while an IME composition is active', () => {
    editor = createTestEditor('<p>hello</p>');
    selectText(editor, 'hello');
    refreshSelection(editor);
    const { input } = controlParts(editor);
    typeDraft(input, '24');

    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        isComposing: true,
        bubbles: true,
        cancelable: true
      })
    );

    expect(editor.getContent()).toBe('<p>hello</p>');
    expect(editor.undoManager.canUndo()).toBe(false);
  });

  it('cancels edits on Escape without creating an undo entry', () => {
    editor = createTestEditor('<p><span style="font-size: 18px">hello</span></p>');
    selectText(editor, 'hello');
    refreshSelection(editor);
    const { input } = controlParts(editor);

    typeDraft(input, '42');
    press(input, 'Escape');

    expect(input.value).toBe('18');
    expect(editor.getContent()).toContain('font-size: 18px');
    expect(editor.undoManager.canUndo()).toBe(false);
  });

  it('supports small and large keyboard steps', () => {
    editor = createTestEditor('<p><span style="font-size: 18px">hello</span></p>');
    selectText(editor, 'hello');
    refreshSelection(editor);
    let input = controlParts(editor).input;

    input.focus();
    press(input, 'ArrowUp');
    expect(editor.getContent()).toContain('font-size: 19px');

    selectText(editor, 'hello');
    refreshSelection(editor);
    input = controlParts(editor).input;
    input.focus();
    press(input, 'ArrowDown', true);
    expect(editor.getContent()).toContain('font-size: 14px');
  });

  it('disables decrement and increment at the configured limits', () => {
    editor = createTestEditor(
      '<p><span style="font-size: 1px">min</span> <span style="font-size: 512px">max</span></p>'
    );

    selectText(editor, 'min');
    refreshSelection(editor);
    expect(controlParts(editor).decrease.disabled).toBe(true);

    selectText(editor, 'max');
    refreshSelection(editor);
    expect(controlParts(editor).increase.disabled).toBe(true);
  });

  it('supports a reusable instance with custom bounds and steps', () => {
    editor = createTestEditor('<p>hello</p>');
    selectText(editor, 'hello');
    const control = createFontSizeControl({
      editor,
      min: 10,
      max: 20,
      step: 2,
      largeStep: 4,
      fallbackSize: 12
    });
    editor.getRoot().appendChild(control.element);
    control.refresh();
    const input = control.element.querySelector<HTMLInputElement>(
      '[data-testid="font-size-input"]'
    )!;
    const increase = control.element.querySelector<HTMLButtonElement>(
      '[data-testid="font-size-increase"]'
    )!;

    expect(input.value).toBe('12');
    increase.click();
    expect(editor.getContent()).toContain('font-size: 14px');
    control.destroy();
  });
});

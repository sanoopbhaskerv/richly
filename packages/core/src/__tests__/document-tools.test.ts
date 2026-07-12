import { afterEach, describe, expect, it } from 'vitest';
import { Editor } from '../editor/Editor';
import { createTestEditor, destroyAll } from './test-utils';

let ed: Editor;
afterEach(() => destroyAll(ed));

describe('document tools', () => {
  it('finds the next match and replaces all matches without flattening markup', () => {
    ed = createTestEditor('<p>Alpha <strong>beta</strong> alpha</p>');

    ed.execCommand('FindReplace', { find: 'alpha', action: 'find' });
    expect(ed.selection.getRange()?.toString()).toBe('Alpha');

    ed.execCommand('FindReplace', {
      find: 'alpha',
      replace: 'omega',
      action: 'replaceAll'
    });
    expect(ed.getContent()).toBe('<p>omega <strong>beta</strong> omega</p>');
  });

  it('toggles visual blocks without changing serialized content', () => {
    ed = createTestEditor('<p>content</p>');
    const before = ed.getContent();

    ed.execCommand('VisualBlocks');
    expect(ed.queryCommandState('VisualBlocks')).toBe(true);
    expect(ed.getBody().classList.contains('rly-visual-blocks')).toBe(true);
    expect(ed.getContent()).toBe(before);
  });

  it('opens and closes a sandboxed preview', () => {
    ed = createTestEditor('<h1>Preview me</h1>');
    ed.execCommand('Preview');

    const frame = document.querySelector<HTMLIFrameElement>('[data-testid="preview-frame"]')!;
    expect(frame).not.toBeNull();
    expect(frame.getAttribute('sandbox')).toBe('');
    expect(frame.srcdoc).toContain('<h1>Preview me</h1>');
    document.querySelector<HTMLButtonElement>('[data-testid="preview-close"]')!.click();
    expect(document.querySelector('[data-testid="preview-overlay"]')).toBeNull();
  });

  it('supports character and selection-aware word counts', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    ed = Editor.init({
      target,
      initialContent: '<p>one two</p>',
      wordCount: { words: true, characters: true, selection: true }
    });
    const text = ed.getBody().querySelector('p')!.firstChild!;
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, 3);
    ed.selection.setRange(range);
    ed.events.emit('selectionchange', undefined);

    expect(ed.getRoot().querySelector('[data-testid="status-wordcount"]')?.textContent).toBe(
      'Selection: 1 word · 3 characters'
    );
  });
});

describe('find/replace session', () => {
  const q = <T extends Element>(testId: string): T =>
    document.querySelector<T>(`[data-testid="${testId}"]`)!;
  const status = (): string => q('findreplace-count').textContent ?? '';
  const setFind = (value: string): void => {
    const find = q<HTMLInputElement>('dialog-field-find');
    find.value = value;
    find.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const setReplace = (value: string): void => {
    q<HTMLInputElement>('dialog-field-replace').value = value;
  };
  const click = (testId: string): void => q<HTMLButtonElement>(testId).click();
  const marks = (): number => ed.getBody().querySelectorAll('mark.rly-match').length;

  it('renders Find, Find Next, Replace, and Replace All actions', () => {
    ed = createTestEditor('<p>dialogue dialogue</p>');
    ed.execCommand('FindReplace');

    expect(q('findreplace-find')).not.toBeNull();
    expect(q('findreplace-find-next')).not.toBeNull();
    expect(q('findreplace-replace')).not.toBeNull();
    expect(q('findreplace-replace-all')).not.toBeNull();
    expect(q('findreplace-count')).not.toBeNull();
  });

  it('shows a live match counter as the query changes', () => {
    ed = createTestEditor('<p>one two one three one</p>');
    ed.execCommand('FindReplace');

    expect(status()).toBe('0 of 0');
    setFind('one');
    expect(status()).toBe('1 of 3');
    setFind('two');
    expect(status()).toBe('1 of 1');
    setFind('missing');
    expect(status()).toBe('0 of 0');
  });

  it('highlights every match, marking the current one distinctly', () => {
    ed = createTestEditor('<p>one one one</p>');
    ed.execCommand('FindReplace');
    setFind('one');

    expect(marks()).toBe(3);
    expect(ed.getBody().querySelectorAll('mark.rly-match-current').length).toBe(1);
    // First mark is current.
    expect(
      ed.getBody().querySelector('mark.rly-match')?.classList.contains('rly-match-current')
    ).toBe(true);
  });

  it('does not reprocess replacement text containing the query', () => {
    ed = createTestEditor('<p>dialogue dialogue dialogue</p>');
    ed.execCommand('FindReplace');
    setFind('dialogue');
    setReplace('dialogue23');

    expect(status()).toBe('1 of 3');

    click('findreplace-replace');
    expect(ed.getContent()).toBe('<p>dialogue23 dialogue dialogue</p>');
    expect(status()).toBe('2 of 3');

    click('findreplace-replace');
    expect(ed.getContent()).toBe('<p>dialogue23 dialogue23 dialogue</p>');
    expect(status()).toBe('3 of 3');

    click('findreplace-replace');
    expect(ed.getContent()).toBe('<p>dialogue23 dialogue23 dialogue23</p>');
    expect(ed.getContent()).not.toContain('dialogue2323');
  });

  it('advances through original ordinals after replacement', () => {
    ed = createTestEditor('<p>dialogue dialogue dialogue</p>');
    ed.execCommand('FindReplace');
    setFind('dialogue');
    setReplace('chat');

    expect(status()).toBe('1 of 3');
    click('findreplace-replace');
    expect(status()).toBe('2 of 3');
    click('findreplace-replace');
    expect(status()).toBe('3 of 3');
    click('findreplace-replace');
    expect(ed.getContent()).toBe('<p>chat chat chat</p>');
  });

  it('supports Find Next by button, Enter, and Shift+Enter with wrap-around', () => {
    ed = createTestEditor('<p>dialogue dialogue dialogue</p>');
    ed.execCommand('FindReplace');
    const find = q<HTMLInputElement>('dialog-field-find');
    setFind('dialogue');

    click('findreplace-find-next');
    expect(status()).toBe('2 of 3');

    find.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(status()).toBe('3 of 3');

    // Wrap forward past the end.
    find.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(status()).toBe('1 of 3');

    // Wrap backward past the start.
    find.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true })
    );
    expect(status()).toBe('3 of 3');
  });

  it('Replace All replaces only remaining original matches and reports the count', () => {
    ed = createTestEditor('<p>dialogue dialogue dialogue</p>');
    ed.execCommand('FindReplace');
    setFind('dialogue');
    setReplace('dialogue23');

    click('findreplace-replace');
    click('findreplace-replace-all');

    expect(ed.getContent()).toBe('<p>dialogue23 dialogue23 dialogue23</p>');
    expect(status()).toBe('Replaced 2 occurrences');
  });

  it('restarts the search cycle only via Find / options, not the replacement field', () => {
    ed = createTestEditor('<p>one one</p>');
    ed.execCommand('FindReplace');
    setFind('one');
    click('findreplace-find-next');
    expect(status()).toBe('2 of 2');

    // Changing replacement text must preserve the current ordinal.
    setReplace('two');
    expect(status()).toBe('2 of 2');

    // Explicit Find restarts and selects the first match.
    click('findreplace-find');
    expect(status()).toBe('1 of 2');
  });

  it('reflects Match case in the results', () => {
    ed = createTestEditor('<p>One one ONE</p>');
    ed.execCommand('FindReplace');
    setFind('one');
    expect(status()).toBe('1 of 3');

    const caseBox = q<HTMLInputElement>('dialog-field-caseSensitive');
    caseBox.checked = true;
    caseBox.dispatchEvent(new Event('change', { bubbles: true }));
    expect(status()).toBe('1 of 1');
  });

  it('cleans transient markers from the DOM and getContent on close', () => {
    ed = createTestEditor('<p>one one one</p>');
    ed.execCommand('FindReplace');
    setFind('one');
    expect(marks()).toBe(3);
    // Markers are invisible to serialization even while live.
    expect(ed.getContent()).toBe('<p>one one one</p>');

    q<HTMLButtonElement>('dialog-close').click();
    expect(marks()).toBe(0);
    expect(document.querySelector('[data-testid="dialog-find-replace"]')).toBeNull();
    expect(ed.getContent()).toBe('<p>one one one</p>');
  });

  it('creates one undo level per replacement', () => {
    ed = createTestEditor('<p>one one</p>');
    ed.execCommand('FindReplace');
    setFind('one');
    setReplace('x');
    click('findreplace-replace');
    expect(ed.getContent()).toBe('<p>x one</p>');

    ed.undoManager.undo();
    expect(ed.getContent()).toBe('<p>one one</p>');
  });
});

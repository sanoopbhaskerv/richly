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

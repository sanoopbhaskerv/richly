import { describe, it, expect, afterEach } from 'vitest';
import type { Editor } from '../editor/Editor';
import { createTestEditor, selectText, destroyAll } from './test-utils';

let ed: Editor;
afterEach(() => destroyAll(ed));

describe('UndoManager', () => {
  it('undoes and redoes a command', () => {
    ed = createTestEditor('<p>hello world</p>');
    selectText(ed, 'hello');
    ed.execCommand('Bold');
    expect(ed.getContent()).toContain('<strong>');

    ed.execCommand('Undo');
    expect(ed.getContent()).toBe('<p>hello world</p>');

    ed.execCommand('Redo');
    expect(ed.getContent()).toContain('<strong>');
  });

  it('stacks multiple levels', () => {
    ed = createTestEditor('<p>hello world</p>');
    selectText(ed, 'hello');
    ed.execCommand('Bold');
    selectText(ed, 'world');
    ed.execCommand('Italic');
    expect(ed.getContent()).toContain('<em>');

    ed.execCommand('Undo');
    expect(ed.getContent()).not.toContain('<em>');
    expect(ed.getContent()).toContain('<strong>');

    ed.execCommand('Undo');
    expect(ed.getContent()).toBe('<p>hello world</p>');
    expect(ed.undoManager.canUndo()).toBe(false);
  });

  it('a new command truncates the redo tail', () => {
    ed = createTestEditor('<p>hello world</p>');
    selectText(ed, 'hello');
    ed.execCommand('Bold');
    ed.execCommand('Undo');
    selectText(ed, 'world');
    ed.execCommand('Italic');
    expect(ed.undoManager.canRedo()).toBe(false);
  });

  it('coalesces rapid typing into one level', () => {
    ed = createTestEditor('<p>x</p>');
    // Simulate a typing burst: content mutates + coalesced snapshots.
    const p = ed.getBody().querySelector('p')!;
    for (const ch of ['a', 'b', 'c']) {
      p.textContent += ch;
      ed.undoManager.snapshot(true);
    }
    expect(ed.getContent()).toBe('<p>xabc</p>');
    ed.undoManager.undo();
    expect(ed.getContent()).toBe('<p>x</p>');
  });

  it('undo is a no-op at the bottom of the stack', () => {
    ed = createTestEditor('<p>stable</p>');
    ed.execCommand('Undo');
    ed.execCommand('Undo');
    expect(ed.getContent()).toBe('<p>stable</p>');
  });
});

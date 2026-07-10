import { afterEach, describe, expect, it } from 'vitest';
import type { Editor } from '../editor/Editor';
import { createTestEditor, destroyAll, placeCursor, selectText } from './test-utils';

let ed: Editor;
afterEach(() => destroyAll(ed));

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('clipboard commands', () => {
  it('selects all editor content', () => {
    ed = createTestEditor('<p>alpha</p><p>beta</p>');
    ed.execCommand('SelectAll');
    expect(ed.selection.getRange()?.toString()).toBe('alphabeta');
  });

  it('copies and pastes through the internal fallback', async () => {
    ed = createTestEditor('<p>alpha beta</p>');
    selectText(ed, 'alpha');
    ed.execCommand('Copy');
    placeCursor(ed, 'beta', 4);
    ed.execCommand('Paste');
    await tick();
    expect(ed.getContent()).toBe('<p>alpha betaalpha</p>');
  });

  it('preserves inline formatting and supports cut', async () => {
    ed = createTestEditor('<p><strong>bold</strong> end</p>');
    selectText(ed, 'bold');
    ed.execCommand('Cut');
    expect(ed.getContent()).toBe('<p> end</p>');

    placeCursor(ed, 'end', 3);
    ed.execCommand('Paste');
    await tick();
    expect(ed.getContent()).toContain('<strong>bold</strong>');
  });
});

import { afterEach, describe, expect, it } from 'vitest';
import type { Editor } from '../editor/Editor';
import { createTestEditor, destroyAll, placeCursor, selectText } from './test-utils';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let ed: Editor;
afterEach(() => destroyAll(ed));

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
const fixture = (name: string): string =>
  readFileSync(resolve(process.cwd(), 'src/__tests__/__fixtures__', name), 'utf8');

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

  it('pastes sanitized Word/GDocs styling and keeps text color, highlight, and font size', () => {
    ed = createTestEditor('<p>end</p>');
    placeCursor(ed, 'end', 0);

    const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
    const html = `${fixture('word-paragraphs.html')}${fixture('google-docs.html')}`;
    Object.defineProperty(event, 'clipboardData', {
      value: {
        getData: (type: string) => (type === 'text/html' ? html : '')
      }
    });

    ed.getBody().dispatchEvent(event);

    const content = ed.getContent();
    expect(content).toContain('color: #1f4e79');
    expect(content).toContain('font-size: 16pt');
    expect(content).toContain('background-color: #fff2cc');
    expect(content).toContain('background-color: #dcfce7');
    expect(content).not.toMatch(/mso-pagination|onclick=|<script|<iframe/i);
  });
});

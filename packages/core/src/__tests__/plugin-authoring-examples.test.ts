import { afterEach, describe, expect, it } from 'vitest';
import type { Editor } from '../editor/Editor';
import { Editor as CoreEditor } from '../editor/Editor';
import { destroyAll, placeCursor, selectText } from './test-utils';
import { customPlugin } from '../../../../examples/custom-plugin/index';
import { highlightPlugin } from '../../../../examples/highlight-plugin/index';
import { createWordGoalPlugin } from '../../../../examples/word-goal-plugin/index';

let ed: Editor;
afterEach(() => destroyAll(ed));

describe('plugin authoring examples: highlight-plugin', () => {
  it('registers a command and toggle button that styles and unstylizes selection', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    ed = CoreEditor.init({
      target,
      initialContent: '<p>hello world</p>',
      plugins: [highlightPlugin],
      toolbar: 'highlight',
      statusbar: true
    });

    expect(ed.getRoot().querySelector('[data-testid="tb-highlight"]')).toBeTruthy();

    selectText(ed, 'hello');
    ed.execCommand('Highlight');
    expect(ed.getContent()).toContain('background-color: rgb(254, 240, 138)');
    expect(ed.queryCommandState('Highlight')).toBe(true);

    selectText(ed, 'hello');
    ed.execCommand('Highlight');
    expect(ed.getContent()).toBe('<p>hello world</p>');
  });

  it('uses the same collapsed-caret behavior as built-in inline styles', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    ed = CoreEditor.init({
      target,
      initialContent: '<p>abc</p>',
      plugins: [highlightPlugin],
      toolbar: 'highlight',
      statusbar: true
    });

    const range = document.createRange();
    const text = ed.getBody().querySelector('p')?.firstChild;
    if (!text) throw new Error('Missing paragraph text node');
    range.setStart(text, 1);
    range.collapse(true);
    ed.selection.setRange(range);

    const before = ed.getContent();
    ed.execCommand('Highlight');
    expect(ed.getContent()).toBe(before);
    expect(ed.queryCommandState('Highlight')).toBe(true);
  });

  it('clips all-but-last list selections without wrapping or duplicating items', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    ed = CoreEditor.init({
      target,
      initialContent: '<ul><li>first</li><li>second</li><li>last</li></ul>',
      plugins: [highlightPlugin],
      toolbar: 'highlight'
    });
    const list = ed.getBody().querySelector('ul')!;
    const items = list.querySelectorAll('li');
    const range = document.createRange();
    range.setStart(list, 0);
    range.setEnd(items[2]!, 0);
    ed.selection.setRange(range);

    ed.execCommand('Highlight');

    expect(ed.getBody().querySelector('span > li')).toBeNull();
    expect(ed.getBody().querySelectorAll('li')).toHaveLength(3);
    expect(items[0]?.querySelector('span')?.style.backgroundColor).toBeTruthy();
    expect(items[1]?.querySelector('span')?.style.backgroundColor).toBeTruthy();
    expect(items[2]?.querySelector('span')).toBeNull();
  });
});

describe('plugin authoring examples: custom timestamp plugin', () => {
  it('inserts an atomic timestamp badge and restores a caret after it', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    ed = CoreEditor.init({
      target,
      initialContent: '<p>Before</p>',
      plugins: [customPlugin],
      toolbar: 'customTimestamp'
    });
    placeCursor(ed, 'Before', 6);

    ed.execCommand('insertCustomTimestamp');

    const badge = ed.getBody().querySelector<HTMLElement>('.custom-timestamp-badge');
    expect(badge?.textContent).toContain('⏱️');
    expect(badge?.contentEditable).toBe('false');
    expect(badge?.nextSibling?.textContent).toBe('\u00a0');
    expect(ed.getContent()).toContain('class="custom-timestamp-badge"');
    expect(ed.getRoot().querySelector('[data-testid="tb-customTimestamp"]')).not.toBeNull();
  });
});

describe('plugin authoring examples: word-goal-plugin', () => {
  it('injects statusbar indicator, applies config thresholds, and emits updates', () => {
    const updates: Array<{ words: number; goal: number; ratio: number; state: string }> = [];
    const target = document.createElement('div');
    document.body.appendChild(target);

    const plugin = createWordGoalPlugin({ goal: 3, warnAt: 0.66, eventName: 'wordgoal:update' });
    ed = CoreEditor.init({
      target,
      initialContent: '<p>one two</p>',
      plugins: [plugin],
      statusbar: true
    });

    ed.on('wordgoal:update', (payload) => {
      updates.push(payload as { words: number; goal: number; ratio: number; state: string });
    });

    const indicator = ed.getRoot().querySelector<HTMLElement>('[data-testid="status-word-goal"]');
    expect(indicator).toBeTruthy();

    ed.setContent('<p>one two</p>');
    expect(indicator?.textContent).toBe('2 / 3 words');
    expect(indicator?.classList.contains('rly-goal-warn')).toBe(true);
    expect(indicator?.classList.contains('rly-goal-ok')).toBe(false);

    ed.setContent('<p>one two three four</p>');
    expect(indicator?.textContent).toBe('4 / 3 words');
    expect(indicator?.classList.contains('rly-goal-ok')).toBe(true);

    const last = updates[updates.length - 1];
    expect(last).toMatchObject({ words: 4, goal: 3, state: 'reached' });
    expect(last?.ratio).toBeGreaterThan(1);
  });
});

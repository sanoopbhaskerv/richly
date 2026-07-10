import { describe, it, expect, afterEach } from 'vitest';
import type { Editor } from '../editor/Editor';
import { createTestEditor, selectText, placeCursor, destroyAll } from './test-utils';

let ed: Editor;
afterEach(() => destroyAll(ed));

describe('lists plugin', () => {
  it('converts a paragraph to a bullet list', () => {
    ed = createTestEditor('<p>item one</p>');
    selectText(ed, 'item');
    ed.execCommand('InsertUnorderedList');
    expect(ed.getContent()).toBe('<ul><li>item one</li></ul>');
    expect(ed.queryCommandState('InsertUnorderedList')).toBe(true);
  });

  it('converts multiple selected paragraphs into one list', () => {
    ed = createTestEditor('<p>aaa</p><p>bbb</p><p>ccc</p>');
    const range = document.createRange();
    range.setStart(ed.getBody().querySelector('p')!.firstChild!, 0);
    range.setEnd(ed.getBody().querySelectorAll('p')[2]!.firstChild!, 3);
    ed.selection.setRange(range);
    ed.execCommand('InsertUnorderedList');
    expect(ed.getContent()).toBe('<ul><li>aaa</li><li>bbb</li><li>ccc</li></ul>');
  });

  it('toggles a list item back to a paragraph', () => {
    ed = createTestEditor('<ul><li>only</li></ul>');
    selectText(ed, 'only');
    ed.execCommand('InsertUnorderedList');
    expect(ed.getContent()).toBe('<p>only</p>');
  });

  it('untoggle in the middle splits the list', () => {
    ed = createTestEditor('<ul><li>aaa</li><li>bbb</li><li>ccc</li></ul>');
    selectText(ed, 'bbb');
    ed.execCommand('InsertUnorderedList');
    expect(ed.getContent()).toBe('<ul><li>aaa</li></ul><p>bbb</p><ul><li>ccc</li></ul>');
  });

  it('switches ul to ol in place', () => {
    ed = createTestEditor('<ul><li>aaa</li><li>bbb</li></ul>');
    selectText(ed, 'aaa');
    ed.execCommand('InsertOrderedList');
    expect(ed.getContent()).toBe('<ol><li>aaa</li><li>bbb</li></ol>');
    expect(ed.queryCommandState('InsertOrderedList')).toBe(true);
    expect(ed.queryCommandState('InsertUnorderedList')).toBe(false);
  });
});

describe('indent/outdent', () => {
  it('Indent nests a list item under its previous sibling', () => {
    ed = createTestEditor('<ul><li>parent</li><li>child</li></ul>');
    placeCursor(ed, 'child', 1);
    ed.execCommand('Indent');
    expect(ed.getContent()).toBe('<ul><li>parent<ul><li>child</li></ul></li></ul>');
  });

  it('Outdent un-nests back', () => {
    ed = createTestEditor('<ul><li>parent<ul><li>child</li></ul></li></ul>');
    placeCursor(ed, 'child', 1);
    ed.execCommand('Outdent');
    expect(ed.getContent()).toBe('<ul><li>parent</li><li>child</li></ul>');
  });

  it('Indent on the first item is a no-op', () => {
    ed = createTestEditor('<ul><li>first</li><li>second</li></ul>');
    placeCursor(ed, 'first', 1);
    ed.execCommand('Indent');
    expect(ed.getContent()).toBe('<ul><li>first</li><li>second</li></ul>');
  });

  it('Indent/Outdent steps padding on plain blocks', () => {
    ed = createTestEditor('<p>text</p>');
    placeCursor(ed, 'text', 1);
    ed.execCommand('Indent');
    expect(ed.getContent()).toBe('<p style="padding-left: 40px;">text</p>');
    ed.execCommand('Indent');
    expect(ed.getContent()).toBe('<p style="padding-left: 80px;">text</p>');
    ed.execCommand('Outdent');
    ed.execCommand('Outdent');
    expect(ed.getContent()).toBe('<p>text</p>');
  });
});

describe('alignment', () => {
  it('JustifyCenter sets text-align and queryState reflects it', () => {
    ed = createTestEditor('<p>centered</p>');
    placeCursor(ed, 'centered', 1);
    ed.execCommand('JustifyCenter');
    expect(ed.getContent()).toBe('<p style="text-align: center;">centered</p>');
    expect(ed.queryCommandState('JustifyCenter')).toBe(true);
    expect(ed.queryCommandState('JustifyLeft')).toBe(false);
  });

  it('JustifyLeft clears the style back to default', () => {
    ed = createTestEditor('<p style="text-align: right">text</p>');
    placeCursor(ed, 'text', 1);
    ed.execCommand('JustifyLeft');
    expect(ed.getContent()).toBe('<p>text</p>');
    expect(ed.queryCommandState('JustifyLeft')).toBe(true);
  });

  it('aligns every block in a multi-block selection', () => {
    ed = createTestEditor('<p>aaa</p><p>bbb</p>');
    const range = document.createRange();
    range.setStart(ed.getBody().querySelectorAll('p')[0]!.firstChild!, 0);
    range.setEnd(ed.getBody().querySelectorAll('p')[1]!.firstChild!, 3);
    ed.selection.setRange(range);
    ed.execCommand('JustifyRight');
    expect(ed.getContent()).toBe(
      '<p style="text-align: right;">aaa</p><p style="text-align: right;">bbb</p>'
    );
  });
});

describe('collapsed-cursor pending formats', () => {
  it('bold-then-type formats the typed text', () => {
    ed = createTestEditor('<p>ab</p>');
    placeCursor(ed, 'ab', 1);
    ed.execCommand('Bold');
    // Simulate typing: browser appends to the caret-container text node.
    const range = ed.selection.getRange()!;
    (range.startContainer as Text).appendData('X');
    expect(ed.getContent()).toBe('<p>a<strong>X</strong>b</p>');
  });

  it('bold-off inside bold text splits at the caret', () => {
    ed = createTestEditor('<p><strong>ab</strong></p>');
    placeCursor(ed, 'ab', 1);
    ed.execCommand('Bold');
    const range = ed.selection.getRange()!;
    (range.startContainer as Text).appendData('X');
    expect(ed.getContent()).toBe('<p><strong>a</strong>X<strong>b</strong></p>');
  });

  it('getContent never leaks caret fillers or empty wrappers', () => {
    ed = createTestEditor('<p>ab</p>');
    placeCursor(ed, 'ab', 1);
    ed.execCommand('Bold'); // pending, never typed into
    expect(ed.getContent()).toBe('<p>ab</p>');
    expect(ed.getContent()).not.toContain('﻿');
  });

  it('queryCommandState is true while a pending format is active', () => {
    ed = createTestEditor('<p>ab</p>');
    placeCursor(ed, 'ab', 1);
    ed.execCommand('Bold');
    expect(ed.queryCommandState('Bold')).toBe(true);
  });
});

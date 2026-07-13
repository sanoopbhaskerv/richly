import { afterEach, describe, expect, it } from 'vitest';
import { createTestEditor, destroyAll } from './test-utils';
import type { Editor } from '../editor/Editor';
import {
  addPresetColor,
  addRecentColor,
  getPresetColors,
  getRecentColors
} from '../ui/colorpicker/RecentColors';

let editor: Editor;
afterEach(() => destroyAll(editor));

describe('color picker instance memory', () => {
  it('keeps six deduplicated recent colors newest first', () => {
    editor = createTestEditor('<p>colors</p>');
    ['#111111', '#222222', '#333333', '#444444', '#555555', '#666666', '#777777'].forEach((color) =>
      addRecentColor(editor, color)
    );
    expect(getRecentColors(editor)).toEqual([
      '#777777',
      '#666666',
      '#555555',
      '#444444',
      '#333333',
      '#222222'
    ]);

    addRecentColor(editor, '#444');
    expect(getRecentColors(editor)[0]).toBe('#444444');
    expect(getRecentColors(editor).filter((color) => color === '#444444')).toHaveLength(1);
  });

  it('uses recent colors as initial presets and stores explicit presets independently', () => {
    editor = createTestEditor('<p>colors</p>');
    addRecentColor(editor, '#3b82f6');
    expect(getPresetColors(editor)).toEqual(['#3B82F6']);

    addPresetColor(editor, '#22c55e');
    expect(getPresetColors(editor)).toEqual(['#22C55E']);
    expect(getRecentColors(editor)).toEqual(['#3B82F6']);
  });
});

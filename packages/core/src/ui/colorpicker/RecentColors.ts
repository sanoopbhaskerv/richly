import type { Editor } from '../../editor/Editor';
import { colorsEqual, normalizeHex } from './ColorUtils';

const recentColorsByEditor = new WeakMap<Editor, string[]>();
const presetColorsByEditor = new WeakMap<Editor, string[]>();

const add = (
  map: WeakMap<Editor, string[]>,
  editor: Editor,
  value: string,
  max: number
): string[] => {
  const color = normalizeHex(value);
  if (!color) return map.get(editor) ?? [];
  const updated = [
    color,
    ...(map.get(editor) ?? []).filter((existing) => !colorsEqual(existing, color))
  ].slice(0, max);
  map.set(editor, updated);
  return updated;
};

export const getRecentColors = (editor: Editor): string[] => [
  ...(recentColorsByEditor.get(editor) ?? [])
];

export const addRecentColor = (editor: Editor, color: string): string[] =>
  add(recentColorsByEditor, editor, color, 6);

export const getPresetColors = (editor: Editor): string[] => {
  const saved = presetColorsByEditor.get(editor);
  return saved ? [...saved] : getRecentColors(editor).slice(0, 5);
};

export const addPresetColor = (editor: Editor, color: string): string[] =>
  add(presetColorsByEditor, editor, color, 6);

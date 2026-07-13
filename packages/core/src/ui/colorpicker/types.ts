import type { Editor } from '../../editor/Editor';

export type ColorPickerMode = 'text' | 'highlight';
export type ColorPickerView = 'palette' | 'custom';
export type CustomPickerTab = 'picker' | 'sliders';

export interface ColorDefinition {
  value: string;
  label?: string;
}

export interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface HsvaColor {
  h: number;
  s: number;
  v: number;
  a: number;
}

export interface ColorPickerOptions {
  mode: ColorPickerMode;
  editor: Editor;
  palette: ColorDefinition[];
  close(): void;
  getCurrentColor(): string;
  onApply(color: string | null): void;
}

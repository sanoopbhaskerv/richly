import { afterEach, describe, expect, it, vi } from 'vitest';
import { createColorPickerPanel } from '../ui/colorpicker/ColorPicker';
import { createTestEditor, destroyAll } from './test-utils';
import type { Editor } from '../editor/Editor';

let editor: Editor;
let panel: HTMLElement;
afterEach(() => {
  panel?.remove();
  destroyAll(editor);
  vi.restoreAllMocks();
});
function setup() {
  editor = createTestEditor('<p>Colors</p>');
  const apply = vi.fn();
  panel = createColorPickerPanel({
    editor,
    mode: 'text',
    palette: [{ value: '#FF0000' }, { value: '#00FF00' }],
    close: vi.fn(),
    getCurrentColor: () => '#FF0000',
    onApply: apply
  });
  document.body.append(panel);
  panel.dispatchEvent(new Event('rly-panel-open'));
  return apply;
}
function control(id: string) {
  return panel.querySelector<HTMLInputElement>(`[data-testid="${id}"]`)!;
}
function input(id: string, value: string) {
  const field = control(id);
  field.value = value;
  field.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('Color picker draft interactions', () => {
  it('rejects invalid HEX, normalizes shorthand, and applies only the valid draft', () => {
    const apply = setup();
    control('custom-color').click();
    input('color-picker-hex', 'not-a-color');
    control('color-picker-hex').dispatchEvent(new Event('blur'));
    expect(control('color-picker-done').disabled).toBe(true);
    expect(control('color-picker-hex').getAttribute('aria-invalid')).toBe('true');
    control('color-picker-done').click();
    expect(apply).not.toHaveBeenCalled();
    input('color-picker-hex', '#abc');
    control('color-picker-hex').dispatchEvent(new Event('blur'));
    expect(control('color-picker-hex').value).toBe('#AABBCC');
    control('color-picker-done').click();
    expect(apply).toHaveBeenCalledWith('#AABBCC');
  });

  it('synchronizes slider and numeric controls, clamps values, and stores a preset', () => {
    setup();
    control('custom-color').click();
    control('color-picker-tab-picker').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight' })
    );
    for (const [key, value] of [
      ['h', '180'],
      ['s', '40'],
      ['v', '70'],
      ['a', '50']
    ]) {
      input(`color-picker-slider-${key}`, value);
      expect(control(`color-picker-number-${key}`).value).toBe(value);
    }
    input('color-picker-number-s', '150');
    expect(control('color-picker-slider-s').value).toBe('100');
    input('color-picker-number-a', '-10');
    expect(control('color-picker-slider-a').value).toBe('0');
    const hex = control('color-picker-hex').value;
    control('color-picker-add-preset').click();
    const presets = panel.querySelectorAll<HTMLButtonElement>(
      '[data-testid^="color-picker-preset-"]'
    );
    expect(presets.length).toBeGreaterThan(0);
    presets[presets.length - 1].click();
    expect(control('color-picker-hex').value).toBe(hex);
    control('color-picker-tab-sliders').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft' })
    );
    expect(control('color-picker-sv')).not.toBeNull();
  });

  it('adjusts saturation and brightness by keyboard and keeps opacity controls in sync', () => {
    setup();
    control('custom-color').click();
    const sv = control('color-picker-sv');
    for (const [key, shiftKey] of [
      ['ArrowLeft', false],
      ['ArrowRight', true],
      ['ArrowDown', true],
      ['ArrowUp', false]
    ] as const) {
      sv.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, cancelable: true }));
    }
    expect(sv.getAttribute('aria-valuetext')).toBe('Saturation 100%, brightness 91%');
    const previous = control('color-picker-hex').value;
    sv.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(control('color-picker-hex').value).toBe(previous);
    input('color-picker-hue', '120');
    input('color-picker-opacity', '50');
    expect(control('color-picker-hex').value).toMatch(/80$/);
    expect(panel.querySelector('output')?.value).toBe('50%');
  });
});

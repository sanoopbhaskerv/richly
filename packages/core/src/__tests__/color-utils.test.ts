import { describe, expect, it } from 'vitest';
import {
  colorsEqual,
  cssColorToHex,
  hexToHsva,
  hexToRgba,
  hsvaToHex,
  normalizeHex,
  rgbaToHex
} from '../ui/colorpicker/ColorUtils';

describe('color picker conversions', () => {
  it('normalizes supported short, long, and alpha HEX values', () => {
    expect(normalizeHex('abc')).toBe('#AABBCC');
    expect(normalizeHex('#abcd')).toBe('#AABBCCDD');
    expect(normalizeHex('12abEF')).toBe('#12ABEF');
    expect(normalizeHex('#12abef80')).toBe('#12ABEF80');
  });

  it('rejects invalid HEX values', () => {
    expect(normalizeHex('#12')).toBeNull();
    expect(normalizeHex('#gggggg')).toBeNull();
    expect(normalizeHex('')).toBeNull();
  });

  it('round trips RGBA including alpha', () => {
    const rgba = hexToRgba('#3B82F680');
    expect(rgba).toMatchObject({ r: 59, g: 130, b: 246 });
    expect(rgba.a).toBeCloseTo(128 / 255);
    expect(rgbaToHex(rgba)).toBe('#3B82F680');
  });

  it.each(['#FF0000', '#22C55E', '#3B82F6', '#000000', '#FFFFFF', '#A855F780'])(
    'round trips %s through HSVA',
    (hex) => expect(hsvaToHex(hexToHsva(hex))).toBe(hex)
  );

  it('compares normalized HEX colors', () => {
    expect(colorsEqual('#fff', '#FFFFFF')).toBe(true);
    expect(colorsEqual('#FFFFFF80', '#ffffff80')).toBe(true);
    expect(colorsEqual('#fff', '#000')).toBe(false);
  });

  it('converts CSS rgb and rgba values', () => {
    expect(cssColorToHex('rgb(59, 130, 246)')).toBe('#3B82F6');
    expect(cssColorToHex('rgba(59, 130, 246, 0.5)')).toBe('#3B82F680');
    expect(cssColorToHex('rgb(59 130 246 / 50%)')).toBe('#3B82F680');
  });
});

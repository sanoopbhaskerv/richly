import type { HsvaColor, RgbaColor } from './types';

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const normalizeHex = (value: string): string | null => {
  let hex = value.trim().replace(/^#/, '');
  if (!/^(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex)) return null;
  if (hex.length === 3 || hex.length === 4) hex = [...hex].map((char) => char + char).join('');
  return `#${hex.toUpperCase()}`;
};

export const hexToRgba = (value: string): RgbaColor => {
  const normalized = normalizeHex(value);
  if (!normalized) throw new Error(`Invalid HEX color: ${value}`);
  const hex = normalized.slice(1);
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
    a: hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1
  };
};

export const rgbaToHex = ({ r, g, b, a }: RgbaColor): string => {
  const channel = (value: number): string =>
    Math.round(clamp(value, 0, 255))
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();
  const alpha = channel(clamp(a, 0, 1) * 255);
  return `#${channel(r)}${channel(g)}${channel(b)}${alpha === 'FF' ? '' : alpha}`;
};

export const rgbaToHsva = ({ r, g, b, a }: RgbaColor): HsvaColor => {
  const red = clamp(r, 0, 255) / 255;
  const green = clamp(g, 0, 255) / 255;
  const blue = clamp(b, 0, 255) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === red) h = 60 * (((green - blue) / delta) % 6);
    else if (max === green) h = 60 * ((blue - red) / delta + 2);
    else h = 60 * ((red - green) / delta + 4);
  }
  if (h < 0) h += 360;
  return {
    h,
    s: max === 0 ? 0 : (delta / max) * 100,
    v: max * 100,
    a: clamp(a, 0, 1)
  };
};

export const hsvaToRgba = ({ h, s, v, a }: HsvaColor): RgbaColor => {
  const hue = ((h % 360) + 360) % 360;
  const saturation = clamp(s, 0, 100) / 100;
  const value = clamp(v, 0, 100) / 100;
  const chroma = value * saturation;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = value - chroma;
  let rgb: [number, number, number];
  if (hue < 60) rgb = [chroma, x, 0];
  else if (hue < 120) rgb = [x, chroma, 0];
  else if (hue < 180) rgb = [0, chroma, x];
  else if (hue < 240) rgb = [0, x, chroma];
  else if (hue < 300) rgb = [x, 0, chroma];
  else rgb = [chroma, 0, x];
  return {
    r: (rgb[0] + m) * 255,
    g: (rgb[1] + m) * 255,
    b: (rgb[2] + m) * 255,
    a: clamp(a, 0, 1)
  };
};

export const hexToHsva = (value: string): HsvaColor => rgbaToHsva(hexToRgba(value));
export const hsvaToHex = (value: HsvaColor): string => rgbaToHex(hsvaToRgba(value));

export const colorsEqual = (a: string, b: string): boolean => {
  const first = normalizeHex(a);
  const second = normalizeHex(b);
  return first !== null && first === second;
};

/** Convert CSS values returned by queryCommandValue into the picker's HEX model. */
export const cssColorToHex = (value: string): string | null => {
  const direct = normalizeHex(value);
  if (direct) return direct;
  const match = value.match(/^rgba?\((.*)\)$/i);
  if (!match?.[1]) return null;
  const channels = match[1]
    .trim()
    .split(/[\s,/]+/)
    .filter(Boolean);
  if (channels.length < 3 || channels.length > 4) return null;
  const [red, green, blue, alphaValue] = channels;
  if (red === undefined || green === undefined || blue === undefined) return null;
  const alpha = alphaValue?.endsWith('%')
    ? Number.parseFloat(alphaValue) / 100
    : Number.parseFloat(alphaValue ?? '1');
  const values = [red, green, blue].map(Number);
  if (values.some((channel) => !Number.isFinite(channel)) || !Number.isFinite(alpha)) return null;
  return rgbaToHex({
    r: values[0]!,
    g: values[1]!,
    b: values[2]!,
    a: alpha
  });
};

import type { ImageAdjustmentChannel, ImageAdjustmentParams } from './types';

/** Numeric range accepted by one adjustment channel. */
export interface ImageAdjustmentSpec {
  /** Inclusive minimum value stored in the non-destructive manifest. */
  readonly min: number;
  /** Inclusive maximum value stored in the non-destructive manifest. */
  readonly max: number;
}

/** Built-in adjustment ranges shared by validation, UI, and renderers. */
export const IMAGE_ADJUSTMENT_SPECS = {
  exposure: { min: -2, max: 2 },
  brightness: { min: -1, max: 1 },
  contrast: { min: -1, max: 1 },
  highlights: { min: -1, max: 1 },
  shadows: { min: -1, max: 1 },
  saturation: { min: -1, max: 1 },
  warmth: { min: -1, max: 1 },
  tint: { min: -1, max: 1 },
  hue: { min: -180, max: 180 },
  blur: { min: 0, max: 20 },
  sharpen: { min: 0, max: 1 },
  grayscale: { min: 0, max: 1 },
  sepia: { min: 0, max: 1 },
  invert: { min: 0, max: 1 }
} as const satisfies Record<ImageAdjustmentChannel, ImageAdjustmentSpec>;

/** Stable list of built-in adjustment channel identifiers. */
export const IMAGE_ADJUSTMENT_CHANNELS = Object.keys(
  IMAGE_ADJUSTMENT_SPECS
) as ImageAdjustmentChannel[];

/** Returns true when a value names a built-in adjustment channel. */
export function isImageAdjustmentChannel(value: unknown): value is ImageAdjustmentChannel {
  return typeof value === 'string' && value in IMAGE_ADJUSTMENT_SPECS;
}

/** Parses and range-checks unknown command params into typed adjustment params. */
export function adjustmentFrom(params: unknown): ImageAdjustmentParams | null {
  if (!params || typeof params !== 'object') return null;
  const value = params as Record<string, unknown>;
  const channel = value.channel;
  const amount = value.value;
  if (!isImageAdjustmentChannel(channel)) return null;
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return null;
  const spec = IMAGE_ADJUSTMENT_SPECS[channel];
  return amount >= spec.min && amount <= spec.max ? { channel, value: amount } : null;
}

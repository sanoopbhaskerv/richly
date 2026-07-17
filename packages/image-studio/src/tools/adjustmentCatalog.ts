import type { ImageAdjustmentChannel } from '@richly/image-core';

/** Slider model used by the Studio adjustment inspector. */
export interface AdjustmentControl {
  /** Core adjustment channel written to the non-destructive manifest. */
  readonly channel: ImageAdjustmentChannel;
  /** Human-readable control label. */
  readonly label: string;
  /** Inspector group heading. */
  readonly group: 'Light' | 'Color' | 'Detail' | 'Effects';
  /** Minimum value shown in the UI. */
  readonly min: number;
  /** Maximum value shown in the UI. */
  readonly max: number;
  /** Numeric step used by slider and value input. */
  readonly step?: number;
  /** Optional suffix shown near the number input. */
  readonly suffix?: string;
  /** Converts a UI value into the normalized core value. */
  readonly toCore: (value: number) => number;
  /** Converts a normalized core value back into the UI value. */
  readonly fromCore: (value: number) => number;
}

/** One-click filter preset represented as a stack of adjustment channels. */
export interface FilterPreset {
  /** Stable preset identifier. */
  readonly id: string;
  /** Button label shown to users. */
  readonly label: string;
  /** CSS background used for the visual swatch. */
  readonly swatch: string;
  /** Core adjustment values applied when selected. */
  readonly adjustments: Partial<Record<ImageAdjustmentChannel, number>>;
}

const percent = {
  toCore: (value: number) => value / 100,
  fromCore: (value: number) => Math.round(value * 100)
};

const exposure = {
  toCore: (value: number) => value / 50,
  fromCore: (value: number) => Math.round(value * 50)
};

const direct = {
  toCore: (value: number) => value,
  fromCore: (value: number) => Math.round(value)
};

/** Ordered adjustment controls rendered in the Adjust tool. */
export const adjustmentControls: readonly AdjustmentControl[] = [
  { channel: 'exposure', label: 'Exposure', group: 'Light', min: -100, max: 100, ...exposure },
  { channel: 'brightness', label: 'Brightness', group: 'Light', min: -100, max: 100, ...percent },
  { channel: 'contrast', label: 'Contrast', group: 'Light', min: -100, max: 100, ...percent },
  { channel: 'highlights', label: 'Highlights', group: 'Light', min: -100, max: 100, ...percent },
  { channel: 'shadows', label: 'Shadows', group: 'Light', min: -100, max: 100, ...percent },
  { channel: 'saturation', label: 'Saturation', group: 'Color', min: -100, max: 100, ...percent },
  { channel: 'warmth', label: 'Warmth', group: 'Color', min: -100, max: 100, ...percent },
  { channel: 'tint', label: 'Tint', group: 'Color', min: -100, max: 100, ...percent },
  { channel: 'hue', label: 'Hue', group: 'Color', min: -180, max: 180, suffix: 'deg', ...direct },
  { channel: 'sharpen', label: 'Sharpen', group: 'Detail', min: 0, max: 100, ...percent },
  { channel: 'blur', label: 'Blur', group: 'Detail', min: 0, max: 20, suffix: 'px', ...direct },
  { channel: 'grayscale', label: 'B&W', group: 'Effects', min: 0, max: 100, ...percent },
  { channel: 'sepia', label: 'Sepia', group: 'Effects', min: 0, max: 100, ...percent },
  { channel: 'invert', label: 'Invert', group: 'Effects', min: 0, max: 100, ...percent }
];

/** All channels controlled by Studio presets and reset actions. */
export const editableAdjustmentChannels = adjustmentControls.map((control) => control.channel);

/** Curated filter presets for quick, undoable looks. */
export const filterPresets: readonly FilterPreset[] = [
  {
    id: 'original',
    label: 'Original',
    swatch: 'linear-gradient(135deg, #dce8f3, #7ea9b8)',
    adjustments: {}
  },
  {
    id: 'vivid',
    label: 'Vivid',
    swatch: 'linear-gradient(135deg, #4f8cff, #ffe071 58%, #1e354e)',
    adjustments: { exposure: 0.16, contrast: 0.18, saturation: 0.28, sharpen: 0.16 }
  },
  {
    id: 'warm',
    label: 'Warm',
    swatch: 'linear-gradient(135deg, #ffb86b, #f2d384 52%, #5c6f87)',
    adjustments: { warmth: 0.45, exposure: 0.08, shadows: 0.18, saturation: 0.12 }
  },
  {
    id: 'cool',
    label: 'Cool',
    swatch: 'linear-gradient(135deg, #7dd3fc, #8ba8ff 56%, #22344b)',
    adjustments: { warmth: -0.36, tint: 0.16, contrast: 0.08, saturation: 0.1 }
  },
  {
    id: 'cinema',
    label: 'Cinema',
    swatch: 'linear-gradient(135deg, #14171f, #2f7086 44%, #f4b86a)',
    adjustments: {
      exposure: -0.12,
      contrast: 0.26,
      shadows: -0.14,
      highlights: -0.18,
      warmth: 0.18
    }
  },
  {
    id: 'matte',
    label: 'Matte',
    swatch: 'linear-gradient(135deg, #c4c8bd, #88948e 52%, #2b3440)',
    adjustments: { contrast: -0.18, shadows: 0.28, highlights: -0.24, saturation: -0.08 }
  },
  {
    id: 'noir',
    label: 'Noir',
    swatch: 'linear-gradient(135deg, #f4f4ee, #888f99 48%, #13161b)',
    adjustments: { grayscale: 1, contrast: 0.28, shadows: -0.16, highlights: 0.12, sharpen: 0.12 }
  },
  {
    id: 'retro',
    label: 'Retro',
    swatch: 'linear-gradient(135deg, #f4c27a, #a77a6d 48%, #31576b)',
    adjustments: { sepia: 0.32, warmth: 0.34, contrast: -0.06, saturation: -0.12 }
  }
];

import type { AdjustDraftChannel, QuickTransformKind } from './quickEdit';
import type { ImageToolbarMode, ImageToolbarRootAction } from './types';

/** Accessible labels for each inline-toolbar mode. */
export const MODE_LABELS: Record<ImageToolbarMode, string> = {
  root: 'Image actions',
  transform: 'Transform image',
  adjust: 'Adjust image'
};

/** Compact adjustment controls exposed by the inline toolbar. */
export const INLINE_ADJUSTMENTS: readonly {
  readonly channel: AdjustDraftChannel;
  readonly icon: string;
  readonly label: string;
}[] = [
  { channel: 'brightness', icon: 'brightness', label: 'Brightness' },
  { channel: 'contrast', icon: 'contrast', label: 'Contrast' },
  { channel: 'saturation', icon: 'saturation', label: 'Saturation' },
  { channel: 'grayscale', icon: 'grayscale', label: 'Grayscale' }
];

/** Root actions kept directly visible in the compact bottom bar. */
export const COMPACT_ROOT_ACTIONS: readonly ImageToolbarRootAction[] = [
  'studio',
  'crop',
  'transform',
  'adjust',
  'more'
];

/** Immediate transform actions rendered by the transform sub-toolbar. */
export const TRANSFORM_ACTIONS: readonly {
  readonly kind: QuickTransformKind;
  readonly icon: string;
  readonly label: string;
  readonly busyLabel: string;
}[] = [
  { kind: 'rotate-left', icon: 'rotateLeft', label: 'Rotate left 90°', busyLabel: 'Rotating' },
  { kind: 'rotate-right', icon: 'rotateRight', label: 'Rotate right 90°', busyLabel: 'Rotating' },
  { kind: 'flip-vertical', icon: 'flipVertical', label: 'Flip vertically', busyLabel: 'Flipping' },
  {
    kind: 'flip-horizontal',
    icon: 'flipHorizontal',
    label: 'Flip horizontally',
    busyLabel: 'Flipping'
  }
];

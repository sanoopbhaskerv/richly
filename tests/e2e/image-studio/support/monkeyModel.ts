/**
 * Deterministic pseudo-random generator (mulberry32) so monkey sessions are
 * fully reproducible from a single integer seed, with no external dependency
 * and no unseeded `Math.random()` calls anywhere in the monkey suite.
 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function pickOne<T>(rng: () => number, items: readonly T[]): T {
  const item = items[Math.floor(rng() * items.length)];
  if (item === undefined) throw new Error('pickOne called with an empty list');
  return item;
}

export type MonkeyTool = 'adjust' | 'crop' | 'transform';
export type MonkeyTransformTab = 'resize' | 'rotate' | 'flip';

/** Minimal model of state the monkey runner needs to pick only safe/valid actions. */
export interface MonkeyState {
  activeTool: MonkeyTool;
  transformTab: MonkeyTransformTab;
  exportOpen: boolean;
}

export interface MonkeyActionDef {
  readonly name: string;
  /** Whether this action is currently valid to execute given the tracked state. */
  isAvailable(state: MonkeyState): boolean;
}

const CROP_ONLY = (state: MonkeyState): boolean => state.activeTool === 'crop' && !state.exportOpen;
const TRANSFORM_RESIZE = (state: MonkeyState): boolean =>
  state.activeTool === 'transform' && state.transformTab === 'resize' && !state.exportOpen;
const TRANSFORM_ROTATE = (state: MonkeyState): boolean =>
  state.activeTool === 'transform' && state.transformTab === 'rotate' && !state.exportOpen;
const TRANSFORM_FLIP = (state: MonkeyState): boolean =>
  state.activeTool === 'transform' && state.transformTab === 'flip' && !state.exportOpen;
const ADJUST_ONLY = (state: MonkeyState): boolean =>
  state.activeTool === 'adjust' && !state.exportOpen;
const EXPORT_ONLY = (state: MonkeyState): boolean => state.exportOpen;
const NOT_EXPORT = (state: MonkeyState): boolean => !state.exportOpen;

/** Every monkey action, with the guard that decides when it is safe to run. */
export const monkeyActions: readonly MonkeyActionDef[] = [
  { name: 'selectToolAdjust', isAvailable: NOT_EXPORT },
  { name: 'selectToolCrop', isAvailable: NOT_EXPORT },
  { name: 'selectToolTransform', isAvailable: NOT_EXPORT },
  { name: 'selectAspectRatio', isAvailable: CROP_ONLY },
  { name: 'dragCropHandle', isAvailable: CROP_ONLY },
  { name: 'moveCropFrame', isAvailable: CROP_ONLY },
  { name: 'applyCrop', isAvailable: CROP_ONLY },
  { name: 'cancelCrop', isAvailable: CROP_ONLY },
  { name: 'resetCrop', isAvailable: CROP_ONLY },
  {
    name: 'selectTransformTabResize',
    isAvailable: (s) => s.activeTool === 'transform' && !s.exportOpen
  },
  {
    name: 'selectTransformTabRotate',
    isAvailable: (s) => s.activeTool === 'transform' && !s.exportOpen
  },
  {
    name: 'selectTransformTabFlip',
    isAvailable: (s) => s.activeTool === 'transform' && !s.exportOpen
  },
  { name: 'changeWidth', isAvailable: TRANSFORM_RESIZE },
  { name: 'changeHeight', isAvailable: TRANSFORM_RESIZE },
  { name: 'toggleAspectLock', isAvailable: TRANSFORM_RESIZE },
  { name: 'toggleResizeUnit', isAvailable: TRANSFORM_RESIZE },
  { name: 'applyResize', isAvailable: TRANSFORM_RESIZE },
  { name: 'cancelResize', isAvailable: TRANSFORM_RESIZE },
  { name: 'rotateLeft', isAvailable: TRANSFORM_ROTATE },
  { name: 'rotateRight', isAvailable: TRANSFORM_ROTATE },
  { name: 'changeStraighten', isAvailable: TRANSFORM_ROTATE },
  { name: 'resetTransformDraft', isAvailable: TRANSFORM_ROTATE },
  { name: 'flipHorizontal', isAvailable: TRANSFORM_FLIP },
  { name: 'flipVertical', isAvailable: TRANSFORM_FLIP },
  { name: 'changeAdjustment', isAvailable: ADJUST_ONLY },
  { name: 'resetAdjustments', isAvailable: ADJUST_ONLY },
  { name: 'undo', isAvailable: NOT_EXPORT },
  { name: 'redo', isAvailable: NOT_EXPORT },
  { name: 'zoomIn', isAvailable: NOT_EXPORT },
  { name: 'zoomOut', isAvailable: NOT_EXPORT },
  { name: 'fit', isAvailable: NOT_EXPORT },
  { name: 'toggleBefore', isAvailable: NOT_EXPORT },
  { name: 'openExport', isAvailable: (s) => !s.exportOpen },
  { name: 'changeExportFormat', isAvailable: EXPORT_ONLY },
  { name: 'changeExportQuality', isAvailable: EXPORT_ONLY },
  { name: 'cancelExport', isAvailable: EXPORT_ONLY },
  { name: 'exportImage', isAvailable: EXPORT_ONLY },
  { name: 'clickFilmstripThumbnail', isAvailable: NOT_EXPORT },
  { name: 'resizeViewport', isAvailable: () => true }
] as const;

/** Selects one currently-available action name using the seeded RNG. */
export function chooseAction(rng: () => number, state: MonkeyState): string {
  const available = monkeyActions.filter((action) => action.isAvailable(state));
  return pickOne(rng, available).name;
}

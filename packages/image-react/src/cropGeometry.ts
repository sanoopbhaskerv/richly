import type { Rect, Size } from '@richly/image-core';

/** Named crop drag target used by pointer and keyboard interaction handlers. */
export type CropHandle = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/** Crop rectangle expressed in transformed-image pixel coordinates. */
export type CropRect = Rect;

const MIN_CROP_SIZE = 16;
const SAME_RATIO_EPSILON = 0.0001;

/** Creates a full-image crop rectangle for no-op initial crop drafts. */
export function createFullCrop(bounds: Size): Rect {
  return { x: 0, y: 0, width: bounds.width, height: bounds.height };
}

/** Returns true when a crop rectangle covers the full transformed image. */
export function isFullCrop(rect: Rect, bounds: Size): boolean {
  return (
    Math.round(rect.x) === 0 &&
    Math.round(rect.y) === 0 &&
    Math.round(rect.width) === Math.round(bounds.width) &&
    Math.round(rect.height) === Math.round(bounds.height)
  );
}

/** Creates the largest centered crop frame for the requested aspect ratio. */
export function createCenteredCrop(bounds: Size, aspectRatio: number | null): Rect {
  const boundsRatio = bounds.width / bounds.height;
  if (!aspectRatio || Math.abs(boundsRatio - aspectRatio) < SAME_RATIO_EPSILON) {
    return createFullCrop(bounds);
  }

  const width = aspectRatio > boundsRatio ? bounds.width : bounds.height * aspectRatio;
  const height = width / aspectRatio;
  return clampRect(
    {
      x: (bounds.width - width) / 2,
      y: (bounds.height - height) / 2,
      width,
      height
    },
    bounds
  );
}

/** Clamps a crop rectangle so it stays inside the transformed image bounds. */
export function clampRect(rect: Rect, bounds: Size): Rect {
  const width = Math.min(bounds.width, Math.max(MIN_CROP_SIZE, rect.width));
  const height = Math.min(bounds.height, Math.max(MIN_CROP_SIZE, rect.height));
  return {
    x: Math.min(Math.max(0, rect.x), Math.max(0, bounds.width - width)),
    y: Math.min(Math.max(0, rect.y), Math.max(0, bounds.height - height)),
    width,
    height
  };
}

/** Moves an existing crop rectangle while preserving its size. */
export function moveCrop(rect: Rect, bounds: Size, deltaX: number, deltaY: number): Rect {
  return clampRect({ ...rect, x: rect.x + deltaX, y: rect.y + deltaY }, bounds);
}

/** Resizes from a named handle while optionally preserving an aspect ratio. */
export function resizeCrop(
  rect: Rect,
  bounds: Size,
  handle: CropHandle,
  deltaX: number,
  deltaY: number,
  aspectRatio: number | null
): Rect {
  if (handle === 'move') return moveCrop(rect, bounds, deltaX, deltaY);

  let x = rect.x;
  let y = rect.y;
  let width = rect.width;
  let height = rect.height;

  if (handle.includes('w')) {
    x += deltaX;
    width -= deltaX;
  }
  if (handle.includes('e')) width += deltaX;
  if (handle.includes('n')) {
    y += deltaY;
    height -= deltaY;
  }
  if (handle.includes('s')) height += deltaY;

  if (aspectRatio) {
    const fromHorizontal = Math.abs(deltaX) >= Math.abs(deltaY);
    if (fromHorizontal) height = width / aspectRatio;
    else width = height * aspectRatio;
    if (handle.includes('w')) x = rect.x + rect.width - width;
    if (handle.includes('n')) y = rect.y + rect.height - height;
  }

  return clampRect({ x, y, width, height }, bounds);
}

/** Converts viewport-pointer movement into transformed-image pixel movement. */
export function pointerDeltaToImageDelta(
  deltaX: number,
  deltaY: number,
  element: DOMRect,
  bounds: Size
): { deltaX: number; deltaY: number } {
  return {
    deltaX: (deltaX / element.width) * bounds.width,
    deltaY: (deltaY / element.height) * bounds.height
  };
}

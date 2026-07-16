import type { Rect, Size } from '@richly/image-core';

/** Named crop drag target used by pointer and keyboard interaction handlers. */
export type CropHandle = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/** Crop rectangle expressed in transformed-image pixel coordinates. */
export type CropRect = Rect;

const MIN_CROP_SIZE = 16;

/** Creates the initial crop frame centered in the current transformed image. */
export function createCenteredCrop(bounds: Size, aspectRatio: number | null): Rect {
  const baseWidth = Math.max(MIN_CROP_SIZE, bounds.width * 0.82);
  const baseHeight = Math.max(MIN_CROP_SIZE, bounds.height * 0.72);
  const width = aspectRatio ? Math.min(baseWidth, baseHeight * aspectRatio) : baseWidth;
  const height = aspectRatio ? width / aspectRatio : baseHeight;
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

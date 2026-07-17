import type { ImageSession } from '@richly/image-core';

type CanvasElement = HTMLCanvasElement | OffscreenCanvas;
type CanvasContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');
}

function createCanvas(width: number, height: number): CanvasElement {
  const offscreen = globalThis as typeof globalThis & {
    OffscreenCanvas?: new (width: number, height: number) => OffscreenCanvas;
  };
  if (offscreen.OffscreenCanvas) return new offscreen.OffscreenCanvas(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function context2d(canvas: CanvasElement): CanvasContext {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('AI image extraction requires a Canvas2D context');
  return context as CanvasContext;
}

function scaledSize(
  width: number,
  height: number,
  maxDimension: number
): { width: number; height: number } {
  const ratio = Math.min(1, maxDimension / width, maxDimension / height);
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio))
  };
}

/** Exports the current session render into bounded ImageData for local AI inference. */
export async function exportSessionImageData(
  session: ImageSession,
  signal: AbortSignal,
  maxDimension = 512
): Promise<ImageData> {
  throwIfAborted(signal);
  const state = session.getState();
  const size = scaledSize(state.outputWidth, state.outputHeight, maxDimension);
  const exported = await session.export({
    type: 'image/png',
    maxWidth: size.width,
    maxHeight: size.height,
    signal
  });
  throwIfAborted(signal);
  const bitmap = await createImageBitmap(exported.blob);
  try {
    throwIfAborted(signal);
    const canvas = createCanvas(bitmap.width, bitmap.height);
    const context = context2d(canvas);
    context.drawImage(bitmap, 0, 0);
    return context.getImageData(0, 0, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}

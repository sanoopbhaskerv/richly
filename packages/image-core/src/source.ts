import { ImageSourceDecodeError } from './errors';
import type { DecodedImageSource, ImageSourceDecoder } from './types';

interface MaybeBitmap {
  readonly width?: number;
  readonly height?: number;
  close?: () => void;
}

function dimensions(value: MaybeBitmap): { width: number; height: number } | null {
  const width = value.width;
  const height = value.height;
  return typeof width === 'number' && typeof height === 'number' && width > 0 && height > 0
    ? { width, height }
    : null;
}

function decodedFromBitmap(
  bitmap: ImageBitmap,
  mimeType: string | undefined,
  ref: string | undefined,
  transferOwnership = false
): DecodedImageSource {
  const size = dimensions(bitmap);
  if (!size) throw new ImageSourceDecodeError('Bitmap source has invalid dimensions');
  return {
    info: { ...size, mimeType, ref },
    bitmap,
    destroy() {
      if (transferOwnership) bitmap.close();
    }
  };
}

/** Default source decoder for browser-capable hosts and test fixtures. */
export const defaultDecoder: ImageSourceDecoder = async (source) => {
  if (source.kind === 'imageData') {
    const size = dimensions(source.data);
    if (!size) throw new ImageSourceDecodeError('ImageData source has invalid dimensions');
    return {
      info: { ...size, mimeType: source.mimeType, ref: source.ref },
      imageData: source.data,
      destroy() {}
    };
  }

  if (source.kind === 'bitmap') {
    return decodedFromBitmap(source.bitmap, source.mimeType, source.ref, source.transferOwnership);
  }

  if (source.kind === 'blob') {
    if (typeof createImageBitmap !== 'function') {
      throw new ImageSourceDecodeError(
        'Blob decoding requires createImageBitmap or a custom decoder'
      );
    }
    const bitmap = await createImageBitmap(source.blob);
    return decodedFromBitmap(bitmap, source.blob.type || undefined, source.ref, true);
  }

  if (typeof fetch !== 'function' || typeof createImageBitmap !== 'function') {
    throw new ImageSourceDecodeError(
      'URL decoding requires fetch/createImageBitmap or a custom decoder'
    );
  }
  const response = await fetch(source.url);
  if (!response.ok)
    throw new ImageSourceDecodeError(`Image URL request failed: ${response.status}`);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);
  return decodedFromBitmap(bitmap, blob.type || undefined, source.ref ?? source.url, true);
};

import type {
  ImageOperation,
  PreviewFrame,
  PreviewHandle,
  PreviewOptions,
  PreviewTarget,
  Size
} from './types';

/** Creates a disposable fake preview until the Canvas2D renderer lands. */
export function createFakePreview(
  target: PreviewTarget,
  options: PreviewOptions | undefined,
  readFrame: () => { revision: number; size: Size; operations: readonly ImageOperation[] }
): PreviewHandle {
  let disposed = false;

  const getFrame = (): PreviewFrame => {
    if (disposed) throw new Error('Preview handle has been disposed');
    const frame = readFrame();
    return {
      width: frame.size.width,
      height: frame.size.height,
      revision: frame.revision,
      operations: frame.operations
    };
  };

  return {
    target,
    getFrame,
    async render() {
      if (options?.signal?.aborted)
        throw options.signal.reason ?? new DOMException('Aborted', 'AbortError');
      return getFrame();
    },
    dispose() {
      disposed = true;
    }
  };
}

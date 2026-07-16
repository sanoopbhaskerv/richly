import type {
  DecodedImageSource,
  ImageOperation,
  PreviewFrame,
  PreviewHandle,
  PreviewOptions,
  PreviewTarget,
  RenderEngine,
  RenderPlan,
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
    async renderBefore() {
      return this.render();
    },
    dispose() {
      disposed = true;
    }
  };
}

/** Creates a render-engine-backed preview with before/after rendering. */
export function createRenderPreview(
  target: PreviewTarget,
  options: PreviewOptions | undefined,
  source: DecodedImageSource,
  engine: RenderEngine,
  readPlan: (before: boolean) => { revision: number; plan: RenderPlan }
): PreviewHandle {
  let disposed = false;

  const renderPlan = async (before: boolean): Promise<PreviewFrame> => {
    if (disposed) throw new Error('Preview handle has been disposed');
    if (options?.signal?.aborted)
      throw options.signal.reason ?? new DOMException('Aborted', 'AbortError');
    const { revision, plan } = readPlan(before);
    const result = await engine.renderPreview(source, plan, target, options);
    return { width: result.width, height: result.height, revision, operations: plan.operations };
  };

  return {
    target,
    getFrame() {
      if (disposed) throw new Error('Preview handle has been disposed');
      const { revision, plan } = readPlan(false);
      return { width: plan.width, height: plan.height, revision, operations: plan.operations };
    },
    render() {
      return renderPlan(false);
    },
    renderBefore() {
      return renderPlan(true);
    },
    dispose() {
      disposed = true;
    }
  };
}

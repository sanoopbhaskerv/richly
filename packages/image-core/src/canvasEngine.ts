import type {
  DecodedImageSource,
  ExportOptions,
  ExportResult,
  PreviewOptions,
  PreviewTarget,
  RenderEngine,
  RenderPlan,
  RenderResult,
  RenderStage
} from './types';

type CanvasElement = HTMLCanvasElement | OffscreenCanvas;
type CanvasContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function abortIfNeeded(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');
}

function createCanvas(width: number, height: number): CanvasElement {
  const offscreen = globalThis as typeof globalThis & {
    OffscreenCanvas?: new (width: number, height: number) => OffscreenCanvas;
  };
  if (offscreen.OffscreenCanvas) return new offscreen.OffscreenCanvas(width, height);
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  throw new Error('Canvas2D rendering requires OffscreenCanvas or document.createElement');
}

function get2d(canvas: CanvasElement): CanvasContext {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas2D context is unavailable');
  return context as CanvasContext;
}

async function toBlob(
  canvas: CanvasElement,
  type: string,
  quality: number | undefined
): Promise<Blob> {
  const withConvert = canvas as OffscreenCanvas & {
    convertToBlob?: (options?: { type?: string; quality?: number }) => Promise<Blob>;
  };
  if (withConvert.convertToBlob) return withConvert.convertToBlob({ type, quality });

  const htmlCanvas = canvas as HTMLCanvasElement;
  if (typeof htmlCanvas.toBlob === 'function') {
    return new Promise((resolve, reject) => {
      htmlCanvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Canvas export failed'))),
        type,
        quality
      );
    });
  }
  throw new Error('Canvas export requires toBlob or convertToBlob support');
}

function drawSource(context: CanvasContext, source: DecodedImageSource): void {
  if (source.imageData) {
    context.putImageData(source.imageData, 0, 0);
    return;
  }
  if (source.bitmap) {
    context.drawImage(source.bitmap, 0, 0);
    return;
  }
  throw new Error('Decoded source has no drawable pixel payload');
}

function rotatedSize(
  width: number,
  height: number,
  angle: number
): { width: number; height: number } {
  const radians = (angle * Math.PI) / 180;
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));
  return {
    width: Math.max(1, Math.round(width * cos + height * sin)),
    height: Math.max(1, Math.round(width * sin + height * cos))
  };
}

function stageCanvas(input: CanvasElement, stage: RenderStage): CanvasElement {
  if (stage.type === 'crop') {
    const { rect } = stage.params as {
      rect: { x: number; y: number; width: number; height: number };
    };
    const output = createCanvas(Math.round(rect.width), Math.round(rect.height));
    get2d(output).drawImage(
      input,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      0,
      0,
      rect.width,
      rect.height
    );
    return output;
  }

  if (stage.type === 'resize') {
    const { width, height } = stage.params as { width: number; height: number };
    const output = createCanvas(Math.round(width), Math.round(height));
    get2d(output).drawImage(input, 0, 0, width, height);
    return output;
  }

  if (stage.type === 'rotate') {
    const { angle } = stage.params as { angle: number };
    const size = rotatedSize(input.width, input.height, angle);
    const output = createCanvas(size.width, size.height);
    const context = get2d(output);
    context.translate(size.width / 2, size.height / 2);
    context.rotate((angle * Math.PI) / 180);
    context.drawImage(input, -input.width / 2, -input.height / 2);
    return output;
  }

  if (stage.type === 'flip') {
    const { axis } = stage.params as { axis: 'horizontal' | 'vertical' };
    const output = createCanvas(input.width, input.height);
    const context = get2d(output);
    context.translate(
      axis === 'horizontal' ? input.width : 0,
      axis === 'vertical' ? input.height : 0
    );
    context.scale(axis === 'horizontal' ? -1 : 1, axis === 'vertical' ? -1 : 1);
    context.drawImage(input, 0, 0);
    return output;
  }

  throw new Error(`No Canvas2D stage renderer registered for "${stage.type}"`);
}

function scaleForExport(
  plan: RenderPlan,
  options: ExportOptions | undefined
): { width: number; height: number } {
  const maxWidth = options?.maxWidth ?? plan.width;
  const maxHeight = options?.maxHeight ?? plan.height;
  const ratio = Math.min(1, maxWidth / plan.width, maxHeight / plan.height);
  return {
    width: Math.max(1, Math.round(plan.width * ratio)),
    height: Math.max(1, Math.round(plan.height * ratio))
  };
}

/** Canvas2D render backend shared by preview and export paths. */
export class Canvas2DRenderEngine implements RenderEngine {
  async renderPreview(
    source: DecodedImageSource,
    plan: RenderPlan,
    target: PreviewTarget,
    options?: PreviewOptions
  ): Promise<RenderResult> {
    abortIfNeeded(options?.signal);
    const output = this.renderToCanvas(source, plan, options?.signal);
    if (target.canvas) {
      target.canvas.width = output.width;
      target.canvas.height = output.height;
      get2d(target.canvas).drawImage(output, 0, 0);
    }
    return { width: output.width, height: output.height };
  }

  async export(
    source: DecodedImageSource,
    plan: RenderPlan,
    options?: ExportOptions
  ): Promise<ExportResult> {
    abortIfNeeded(options?.signal);
    const rendered = this.renderToCanvas(source, plan, options?.signal);
    const targetSize = scaleForExport(plan, options);
    const output = createCanvas(targetSize.width, targetSize.height);
    const context = get2d(output);
    const mimeType = options?.type ?? 'image/png';

    if (mimeType === 'image/jpeg') {
      context.fillStyle = '#fff';
      context.fillRect(0, 0, output.width, output.height);
    }
    context.drawImage(rendered, 0, 0, output.width, output.height);
    const blob = await toBlob(output, mimeType, options?.quality);
    return { width: output.width, height: output.height, mimeType: blob.type || mimeType, blob };
  }

  private renderToCanvas(
    source: DecodedImageSource,
    plan: RenderPlan,
    signal: AbortSignal | undefined
  ): CanvasElement {
    abortIfNeeded(signal);
    let canvas = createCanvas(source.info.width, source.info.height);
    drawSource(get2d(canvas), source);
    for (const stage of plan.stages) {
      abortIfNeeded(signal);
      canvas = stageCanvas(canvas, stage);
    }
    return canvas;
  }
}

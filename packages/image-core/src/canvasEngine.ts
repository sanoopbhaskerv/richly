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
import type { ImageAdjustmentChannel, ImageAdjustmentParams } from './types';

type CanvasElement = HTMLCanvasElement | OffscreenCanvas;
type CanvasContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type PixelAdjustmentChannel = 'highlights' | 'shadows' | 'warmth' | 'tint' | 'sharpen';

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

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function drawWithFilter(input: CanvasElement, filter: string): CanvasElement {
  const output = createCanvas(input.width, input.height);
  const context = get2d(output);
  const filterContext = context as CanvasContext & { filter?: string };
  // Canvas filters are not uniformly implemented in every non-browser
  // OffscreenCanvas host. If unavailable, keep rendering deterministic by
  // drawing the input unchanged instead of dropping the whole export.
  if ('filter' in filterContext) filterContext.filter = filter;
  context.drawImage(input, 0, 0);
  if ('filter' in filterContext) filterContext.filter = 'none';
  return output;
}

function applyPixelAdjustment(
  canvas: CanvasElement,
  channel: PixelAdjustmentChannel,
  value: number
): void {
  if (value === 0) return;
  const context = get2d(canvas);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  if (channel === 'sharpen') {
    applySharpen(image, value);
  } else {
    applyTonePixels(image, channel, value);
  }
  context.putImageData(image, 0, 0);
}

function applyTonePixels(
  image: ImageData,
  channel: Exclude<PixelAdjustmentChannel, 'sharpen'>,
  value: number
): void {
  const data = image.data;
  for (let index = 0; index < data.length; index += 4) {
    const red = data[index]!;
    const green = data[index + 1]!;
    const blue = data[index + 2]!;
    const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
    if (channel === 'warmth') {
      data[index] = clampByte(red + value * 36);
      data[index + 2] = clampByte(blue - value * 36);
    } else if (channel === 'tint') {
      data[index] = clampByte(red + value * 24);
      data[index + 1] = clampByte(green - value * 32);
      data[index + 2] = clampByte(blue + value * 24);
    } else {
      const shadowWeight = Math.max(0, 1 - luminance / 128);
      const highlightWeight = Math.max(0, (luminance - 128) / 127);
      const amount = value * 56 * (channel === 'shadows' ? shadowWeight : highlightWeight);
      data[index] = clampByte(red + amount);
      data[index + 1] = clampByte(green + amount);
      data[index + 2] = clampByte(blue + amount);
    }
  }
}

function applySharpen(image: ImageData, value: number): void {
  const amount = Math.max(0, Math.min(1, value));
  const source = new Uint8ClampedArray(image.data);
  const { width, height, data } = image;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        const center = source[index + channel]!;
        const top = source[index - width * 4 + channel]!;
        const bottom = source[index + width * 4 + channel]!;
        const left = source[index - 4 + channel]!;
        const right = source[index + 4 + channel]!;
        data[index + channel] = clampByte(
          center * (1 + 4 * amount) - amount * (top + bottom + left + right)
        );
      }
    }
  }
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

  if (stage.type === 'adjust') {
    const { channel, value } = stage.params as ImageAdjustmentParams;
    const filter = adjustmentFilter(channel, value);
    const output = filter ? drawWithFilter(input, filter) : drawWithFilter(input, 'none');
    if (isPixelAdjustment(channel)) applyPixelAdjustment(output, channel, value);
    return output;
  }

  throw new Error(`No Canvas2D stage renderer registered for "${stage.type}"`);
}

function adjustmentFilter(channel: ImageAdjustmentChannel, value: number): string | null {
  if (channel === 'exposure') return `brightness(${Math.max(0, 2 ** value)})`;
  if (channel === 'brightness') return `brightness(${Math.max(0, 1 + value)})`;
  if (channel === 'contrast') return `contrast(${Math.max(0, 1 + value)})`;
  if (channel === 'saturation') return `saturate(${Math.max(0, 1 + value)})`;
  if (channel === 'grayscale') return `grayscale(${value})`;
  if (channel === 'sepia') return `sepia(${value})`;
  if (channel === 'invert') return `invert(${value})`;
  if (channel === 'hue') return `hue-rotate(${value}deg)`;
  if (channel === 'blur') return `blur(${Math.max(0, value)}px)`;
  return null;
}

function isPixelAdjustment(channel: ImageAdjustmentChannel): channel is PixelAdjustmentChannel {
  return (
    channel === 'highlights' ||
    channel === 'shadows' ||
    channel === 'warmth' ||
    channel === 'tint' ||
    channel === 'sharpen'
  );
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

import type { ImageAdjustmentChannel } from '@richly/image-core';
import type {
  LiteRtAdjustmentOutputSpec,
  LiteRtAdjustmentSuggestion,
  LiteRtAiProvider,
  LiteRtCompiledModel,
  LiteRtCoreImporter,
  LiteRtCoreModule,
  LiteRtImageAiProviderOptions,
  LiteRtImageTensorSpec,
  LiteRtModelHandle,
  LiteRtModelSource,
  LiteRtRuntime,
  LiteRtRuntimeOptions,
  LiteRtRuntimeState,
  LiteRtSmartEnhanceRequest,
  LiteRtSmartEnhanceResult,
  LiteRtSmartEnhanceSpec,
  LiteRtTensor,
  LiteRtTensorData,
  LiteRtTensorList
} from './types';

const DEFAULT_CHANNELS: readonly ImageAdjustmentChannel[] = [
  'exposure',
  'contrast',
  'saturation',
  'sharpen'
];

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Lazily imports `@litertjs/core` without creating a static bundle edge.
 *
 * This package can be built and tested without the optional peer installed.
 * Hosts that enable AI install `@litertjs/core` and serve its Wasm files.
 */
export const defaultLiteRtCoreImporter: LiteRtCoreImporter = async () => {
  const dynamicImport = new Function('specifier', 'return import(specifier)') as (
    specifier: string
  ) => Promise<LiteRtCoreModule>;
  return dynamicImport('@litertjs/core');
};

/** Creates a reusable lazy LiteRT.js runtime. */
export function createLiteRtRuntime(options: LiteRtRuntimeOptions): LiteRtRuntime {
  let core: LiteRtCoreModule | null = null;
  let init: Promise<void> | null = null;
  let state: LiteRtRuntimeState = {
    initialized: false,
    accelerator: options.accelerator ?? 'webgpu',
    error: null
  };
  const models = new Map<string, LiteRtModelHandle>();

  const initialize = async (signal?: AbortSignal): Promise<void> => {
    throwIfAborted(signal);
    if (state.initialized) return;
    if (!init) {
      init = (async () => {
        try {
          const imported = await (options.importCore ?? defaultLiteRtCoreImporter)();
          throwIfAborted(signal);
          await imported.loadLiteRt(options.wasmUrl, {
            jspi: options.jspi ?? state.accelerator === 'webnn'
          });
          throwIfAborted(signal);
          core = imported;
          state = { ...state, initialized: true, error: null };
        } catch (error) {
          state = { ...state, initialized: false, error: messageFrom(error) };
          init = null;
          throw error;
        }
      })();
    }
    await init;
  };

  return {
    getState: () => state,
    initialize,
    async loadModel(
      id: string,
      label: string,
      source: LiteRtModelSource,
      signal?: AbortSignal
    ): Promise<LiteRtModelHandle> {
      const cached = models.get(id);
      if (cached) return cached;
      await initialize(signal);
      throwIfAborted(signal);
      if (!core) throw new Error('LiteRT runtime did not initialize');
      const model = await core.loadAndCompile(source, {
        accelerator: state.accelerator,
        webNNOptions:
          state.accelerator === 'webnn'
            ? { devicePreference: options.webNNDevicePreference ?? 'npu' }
            : undefined
      });
      throwIfAborted(signal);
      const handle = createModelHandle(id, label, model);
      models.set(id, handle);
      return handle;
    },
    async createTensor(data: LiteRtTensorData, shape: readonly number[]): Promise<LiteRtTensor> {
      await initialize();
      if (!core) throw new Error('LiteRT runtime did not initialize');
      return new core.Tensor(data, shape);
    },
    dispose() {
      for (const model of models.values()) model.dispose();
      models.clear();
      core = null;
      init = null;
      state = { ...state, initialized: false };
    }
  };
}

function createModelHandle(
  id: string,
  label: string,
  model: LiteRtCompiledModel
): LiteRtModelHandle {
  return {
    id,
    label,
    model,
    dispose() {
      model.delete?.();
    }
  };
}

/** Creates an Image Studio-compatible LiteRT AI provider. */
export function createLiteRtImageAiProvider(
  options: LiteRtImageAiProviderOptions
): LiteRtAiProvider {
  const runtime = createLiteRtRuntime(options);
  return {
    async getStatus() {
      const state = runtime.getState();
      if (!options.smartEnhance) {
        return {
          available: false,
          label: 'Model missing',
          detail: 'Configure a Smart Enhance .tflite model to enable AI editing.',
          accelerator: state.accelerator
        };
      }
      if (state.error) {
        return {
          available: false,
          label: 'Runtime error',
          detail: state.error,
          accelerator: state.accelerator
        };
      }
      return {
        available: true,
        label: state.initialized ? 'Ready' : 'Ready to load',
        detail: `${options.smartEnhance.label} will run locally in the browser.`,
        accelerator: state.accelerator
      };
    },
    smartEnhance: options.smartEnhance
      ? (request) => runSmartEnhance(runtime, options.smartEnhance!, request)
      : undefined,
    dispose() {
      runtime.dispose();
    }
  };
}

async function runSmartEnhance(
  runtime: LiteRtRuntime,
  spec: LiteRtSmartEnhanceSpec,
  request: LiteRtSmartEnhanceRequest
): Promise<LiteRtSmartEnhanceResult> {
  throwIfAborted(request.signal);
  const handle = await runtime.loadModel(spec.id, spec.label, spec.source, request.signal);
  const inputData = imageDataToTensor(request.imageData, spec.input);
  const shape =
    (spec.input.layout ?? 'nchw') === 'nhwc'
      ? [1, spec.input.height, spec.input.width, 3]
      : [1, 3, spec.input.height, spec.input.width];
  const input = await runtime.createTensor(inputData, shape);
  let outputs: readonly LiteRtTensor[] | LiteRtTensorList | null = null;
  try {
    throwIfAborted(request.signal);
    outputs = await handle.model.run(input);
    throwIfAborted(request.signal);
    const output = firstOutput(outputs);
    const vector = await readTensor(output);
    const adjustments = vectorToAdjustments(vector, spec.output);
    return {
      label: `Apply ${spec.label}`,
      adjustments,
      model: spec.label,
      accelerator: runtime.getState().accelerator
    };
  } finally {
    input.delete?.();
    if (outputs) releaseOutputs(outputs);
  }
}

function imageDataToTensor(image: ImageData, spec: LiteRtImageTensorSpec): Float32Array {
  const output = new Float32Array(spec.width * spec.height * 3);
  const scale = spec.scale ?? 1 / 255;
  const mean = spec.mean ?? [0, 0, 0];
  const std = spec.std ?? [1, 1, 1];
  const layout = spec.layout ?? 'nchw';

  for (let y = 0; y < spec.height; y += 1) {
    const sourceY = Math.min(image.height - 1, Math.floor((y / spec.height) * image.height));
    for (let x = 0; x < spec.width; x += 1) {
      const sourceX = Math.min(image.width - 1, Math.floor((x / spec.width) * image.width));
      const sourceIndex = (sourceY * image.width + sourceX) * 4;
      const pixel = [
        ((image.data[sourceIndex] ?? 0) * scale - mean[0]) / std[0],
        ((image.data[sourceIndex + 1] ?? 0) * scale - mean[1]) / std[1],
        ((image.data[sourceIndex + 2] ?? 0) * scale - mean[2]) / std[2]
      ] as const;
      for (let channel = 0; channel < 3; channel += 1) {
        const outputIndex =
          layout === 'nhwc'
            ? (y * spec.width + x) * 3 + channel
            : channel * spec.width * spec.height + y * spec.width + x;
        output[outputIndex] = pixel[channel] ?? 0;
      }
    }
  }
  return output;
}

function firstOutput(outputs: readonly LiteRtTensor[] | LiteRtTensorList): LiteRtTensor {
  const output = outputs[0];
  if (!output) throw new Error('LiteRT model returned no outputs');
  return output;
}

function releaseOutputs(outputs: readonly LiteRtTensor[] | LiteRtTensorList): void {
  for (let index = 0; index < outputs.length; index += 1) outputs[index]?.delete?.();
  (outputs as LiteRtTensorList).delete?.();
}

async function readTensor(tensor: LiteRtTensor): Promise<LiteRtTensorData> {
  if (tensor.toTypedArray) return tensor.toTypedArray();
  if (tensor.data) return tensor.data();
  if (tensor.moveTo) {
    const moved = await tensor.moveTo('wasm');
    try {
      if (moved.toTypedArray) return moved.toTypedArray();
      if (moved.data) return moved.data();
    } finally {
      moved.delete?.();
    }
  }
  throw new Error('LiteRT tensor output is not readable');
}

function vectorToAdjustments(
  vector: LiteRtTensorData,
  spec: LiteRtAdjustmentOutputSpec
): readonly LiteRtAdjustmentSuggestion[] {
  const channels = spec.channels.length > 0 ? spec.channels : DEFAULT_CHANNELS;
  const scale = spec.scale ?? 1;
  const offset = spec.offset ?? 0;
  const clamp = spec.clamp ?? 1;
  const suggestions: LiteRtAdjustmentSuggestion[] = [];
  for (let index = 0; index < channels.length; index += 1) {
    const channel = channels[index];
    if (!channel) continue;
    const raw = Number(vector[index] ?? 0);
    const value = Math.max(-clamp, Math.min(clamp, raw * scale + offset));
    if (Number.isFinite(value) && value !== 0) suggestions.push({ channel, value });
  }
  return suggestions;
}

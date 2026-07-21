import {
  createLiteRtImageAiProvider,
  type LiteRtAccelerator,
  type LiteRtCoreModule
} from '@richly/image-ai-litert';
import type { ImageAdjustmentChannel } from '@richly/image-core';
import type { ImageStudioAiProvider } from '@richly/image-studio';

export type { LiteRtAccelerator };

type DemoModelLayout = 'nchw' | 'nhwc';

const DEFAULT_CHANNELS = [
  'exposure',
  'contrast',
  'saturation',
  'sharpen'
] as const satisfies readonly ImageAdjustmentChannel[];
const ADJUSTMENT_CHANNELS = new Set<ImageAdjustmentChannel>([
  'exposure',
  'brightness',
  'contrast',
  'highlights',
  'shadows',
  'saturation',
  'warmth',
  'tint',
  'hue',
  'blur',
  'sharpen',
  'grayscale',
  'sepia',
  'invert'
]);

/** Demo-only override for wiring a user-selected real LiteRT model. */
export interface DemoAiProviderConfig {
  /** LiteRT accelerator selected by the demo runtime control. */
  readonly accelerator?: LiteRtAccelerator;
  /** Object URL or public URL for a Smart Enhance `.tflite` model. */
  readonly smartEnhanceModelUrl?: string;
  /** Human-readable label shown in the AI Tools status panel. */
  readonly smartEnhanceLabel?: string;
  /** Input tensor layout for the selected model profile. */
  readonly smartEnhanceLayout?: DemoModelLayout;
  /** Output channels to read from the model vector. */
  readonly smartEnhanceChannels?: readonly ImageAdjustmentChannel[];
  /** Multiplier for turning raw model output into normalized adjustments. */
  readonly smartEnhanceOutputScale?: number;
  /** Raises tiny non-zero model outputs into visibly testable adjustment values. */
  readonly smartEnhanceMinimumVisibleMagnitude?: number;
  /** Absolute clamp for normalized adjustments. */
  readonly smartEnhanceOutputClamp?: number;
}

function envValue(name: string): string | undefined {
  const value = (import.meta.env as Record<string, string | undefined>)[name]?.trim();
  return value ? value : undefined;
}

function numberEnv(name: string, fallback: number): number {
  const value = Number(envValue(name));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function acceleratorEnv(): LiteRtAccelerator {
  const value = envValue('VITE_IMAGE_STUDIO_AI_ACCELERATOR');
  return value === 'wasm' || value === 'webgpu' || value === 'webnn' ? value : 'webgpu';
}

function webNNDevicePreferenceEnv(): 'cpu' | 'gpu' | 'npu' | undefined {
  const value = envValue('VITE_IMAGE_STUDIO_AI_WEBNN_DEVICE');
  return value === 'cpu' || value === 'gpu' || value === 'npu' ? value : undefined;
}

function isAdjustmentChannel(value: string): value is ImageAdjustmentChannel {
  return ADJUSTMENT_CHANNELS.has(value as ImageAdjustmentChannel);
}

function channelEnv(): readonly ImageAdjustmentChannel[] {
  const channels = envValue('VITE_IMAGE_STUDIO_SMART_ENHANCE_CHANNELS')
    ?.split(',')
    .map((item) => item.trim())
    .filter(isAdjustmentChannel)
    .filter(Boolean);
  return channels?.length ? channels : DEFAULT_CHANNELS;
}

/** Creates the demo's real LiteRT-backed AI provider from Vite env configuration. */
export function createDemoAiProvider(config: DemoAiProviderConfig = {}): ImageStudioAiProvider {
  const modelUrl =
    config.smartEnhanceModelUrl ?? envValue('VITE_IMAGE_STUDIO_SMART_ENHANCE_MODEL_URL');
  return createLiteRtImageAiProvider({
    wasmUrl: envValue('VITE_IMAGE_STUDIO_AI_WASM_URL') ?? '/litert/wasm/',
    accelerator: config.accelerator ?? acceleratorEnv(),
    webNNDevicePreference: webNNDevicePreferenceEnv(),
    importCore: async () => (await import('@litertjs/core')) as unknown as LiteRtCoreModule,
    smartEnhance: modelUrl
      ? {
          id: 'demo-smart-enhance',
          label:
            config.smartEnhanceLabel ??
            envValue('VITE_IMAGE_STUDIO_SMART_ENHANCE_LABEL') ??
            'Smart Enhance',
          source: modelUrl,
          input: {
            width: numberEnv('VITE_IMAGE_STUDIO_SMART_ENHANCE_WIDTH', 224),
            height: numberEnv('VITE_IMAGE_STUDIO_SMART_ENHANCE_HEIGHT', 224),
            layout:
              config.smartEnhanceLayout ??
              (envValue('VITE_IMAGE_STUDIO_SMART_ENHANCE_LAYOUT') === 'nhwc' ? 'nhwc' : 'nchw')
          },
          output: {
            channels: config.smartEnhanceChannels ?? channelEnv(),
            scale:
              config.smartEnhanceOutputScale ??
              Number(envValue('VITE_IMAGE_STUDIO_SMART_ENHANCE_OUTPUT_SCALE') ?? 1),
            minimumVisibleMagnitude: config.smartEnhanceMinimumVisibleMagnitude,
            clamp:
              config.smartEnhanceOutputClamp ??
              Number(envValue('VITE_IMAGE_STUDIO_SMART_ENHANCE_OUTPUT_CLAMP') ?? 1)
          }
        }
      : undefined
  });
}

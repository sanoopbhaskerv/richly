import type { ImageAdjustmentChannel } from '@richly/image-core';

/** Canonical package name for the optional LiteRT.js integration package. */
export const IMAGE_AI_LITERT_PACKAGE_NAME = '@richly/image-ai-litert';

/** LiteRT.js accelerator requested by a host application. */
export type LiteRtAccelerator = 'wasm' | 'webgpu' | 'webnn';

/** Typed array inputs and outputs supported by the lightweight tensor bridge. */
export type LiteRtTensorData = Float32Array | Int32Array | Uint8Array | Uint8ClampedArray;

/** Minimal LiteRT.js tensor surface used by the provider. */
export interface LiteRtTensor {
  /** Reads tensor data from its current device when the runtime supports it. */
  data?: () => Promise<LiteRtTensorData>;
  /** Moves GPU/WebNN-backed output into Wasm/CPU-readable memory. */
  moveTo?: (target: 'wasm') => Promise<LiteRtTensor>;
  /** Returns the CPU-readable typed array for runtimes exposing this helper. */
  toTypedArray?: () => LiteRtTensorData;
  /** Releases runtime-owned tensor buffers. */
  delete?: () => void;
}

/** Array-like tensor output collection returned by LiteRT.js model execution. */
export interface LiteRtTensorList extends ArrayLike<LiteRtTensor> {
  /** Releases runtime-owned output collection buffers when supported. */
  delete?: () => void;
}

/** Minimal LiteRT.js compiled model surface used by the provider. */
export interface LiteRtCompiledModel {
  /** Runs inference with one or more tensors and returns runtime-owned outputs. */
  run(
    input: LiteRtTensor | readonly LiteRtTensor[] | Record<string, LiteRtTensor>
  ): Promise<readonly LiteRtTensor[] | LiteRtTensorList>;
  /** Optional model metadata exposed by LiteRT.js for debugging. */
  getInputDetails?: () => unknown;
  /** Optional model metadata exposed by LiteRT.js for debugging. */
  getOutputDetails?: () => unknown;
  /** Releases compiled model resources when supported by the runtime. */
  delete?: () => void;
}

/** Minimal @litertjs/core module surface, injected for tests or dynamically imported in hosts. */
export interface LiteRtCoreModule {
  /** Loads LiteRT.js Wasm support files from a host-served directory. */
  loadLiteRt(wasmUrl: string, options?: { readonly jspi?: boolean }): Promise<void>;
  /** Loads and compiles a `.tflite` model from a URL or host-fetched bytes. */
  loadAndCompile(
    source: LiteRtModelSource,
    options?: {
      readonly accelerator?: LiteRtAccelerator;
      readonly webNNOptions?: { readonly devicePreference?: 'gpu' | 'npu' | 'cpu' };
    }
  ): Promise<LiteRtCompiledModel>;
  /** Runtime tensor constructor from `@litertjs/core`. */
  readonly Tensor: new (data: LiteRtTensorData, shape: readonly number[]) => LiteRtTensor;
}

/** Function used to obtain `@litertjs/core` lazily. */
export type LiteRtCoreImporter = () => Promise<LiteRtCoreModule>;

/** Model source accepted by LiteRT.js. */
export type LiteRtModelSource = string | Uint8Array;

/** Runtime loading state surfaced to Studio UI. */
export interface LiteRtRuntimeState {
  /** Whether LiteRT Wasm files have been loaded. */
  readonly initialized: boolean;
  /** Accelerator requested for future model compilation. */
  readonly accelerator: LiteRtAccelerator;
  /** Last runtime initialization error, if any. */
  readonly error: string | null;
}

/** Host configuration for a lazy LiteRT.js runtime. */
export interface LiteRtRuntimeOptions {
  /** URL prefix serving the files from `node_modules/@litertjs/core/wasm/`. */
  readonly wasmUrl: string;
  /** Preferred accelerator; unsupported operators still fall back inside LiteRT.js. */
  readonly accelerator?: LiteRtAccelerator;
  /** Enables JSPI when opting into experimental WebNN. */
  readonly jspi?: boolean;
  /** Device preference passed to WebNN when accelerator is `webnn`. */
  readonly webNNDevicePreference?: 'gpu' | 'npu' | 'cpu';
  /** Test seam or custom loader for the `@litertjs/core` module. */
  readonly importCore?: LiteRtCoreImporter;
}

/** Loaded model wrapper with explicit disposal. */
export interface LiteRtModelHandle {
  /** Stable model id from the host's model catalog. */
  readonly id: string;
  /** Human-readable label shown in diagnostics. */
  readonly label: string;
  /** Compiled LiteRT model. */
  readonly model: LiteRtCompiledModel;
  /** Releases model resources. */
  dispose(): void;
}

/** Lazy runtime abstraction shared by task-specific providers. */
export interface LiteRtRuntime {
  /** Returns the current runtime state without loading Wasm or models. */
  getState(): LiteRtRuntimeState;
  /** Loads the Wasm runtime if it has not already been loaded. */
  initialize(signal?: AbortSignal): Promise<void>;
  /** Loads and compiles a model if it is not already cached. */
  loadModel(
    id: string,
    label: string,
    source: LiteRtModelSource,
    signal?: AbortSignal
  ): Promise<LiteRtModelHandle>;
  /** Creates a runtime tensor using the loaded LiteRT Tensor constructor. */
  createTensor(data: LiteRtTensorData, shape: readonly number[]): Promise<LiteRtTensor>;
  /** Releases compiled models cached by this runtime. */
  dispose(): void;
}

/** Image tensor preprocessing expected by a configured model. */
export interface LiteRtImageTensorSpec {
  /** Input tensor width in pixels. */
  readonly width: number;
  /** Input tensor height in pixels. */
  readonly height: number;
  /** Input layout expected by the converted model. */
  readonly layout?: 'nchw' | 'nhwc';
  /** Scalar applied to each 0-255 color channel before normalization. */
  readonly scale?: number;
  /** Per-channel mean subtracted after scaling. */
  readonly mean?: readonly [number, number, number];
  /** Per-channel divisor applied after mean subtraction. */
  readonly std?: readonly [number, number, number];
}

/** Maps a vector model output into existing Image Studio adjustment channels. */
export interface LiteRtAdjustmentOutputSpec {
  /** Output channels in the same order as the model vector. */
  readonly channels: readonly ImageAdjustmentChannel[];
  /** Multiplier applied to every vector value before clamping. */
  readonly scale?: number;
  /** Offset added after scaling. */
  readonly offset?: number;
  /** Raises tiny non-zero outputs to a visible magnitude for demo or classifier-derived models. */
  readonly minimumVisibleMagnitude?: number;
  /** Absolute clamp for normalized adjustment values. Defaults to 1. */
  readonly clamp?: number;
}

/** Configuration for the first LiteRT-backed Smart Enhance task. */
export interface LiteRtSmartEnhanceSpec {
  /** Stable model id used for runtime cache keys. */
  readonly id: string;
  /** Human-readable model label shown in Studio diagnostics. */
  readonly label: string;
  /** URL or bytes for the `.tflite` model. */
  readonly source: LiteRtModelSource;
  /** Input tensor preprocessing expected by the model. */
  readonly input: LiteRtImageTensorSpec;
  /** Output vector mapping to Image Studio adjustments. */
  readonly output: LiteRtAdjustmentOutputSpec;
}

/** Image pixels passed from Studio into Smart Enhance. */
export interface LiteRtSmartEnhanceRequest {
  /** Current rendered image pixels. */
  readonly imageData: ImageData;
  /** Optional cancellation signal owned by the Studio panel. */
  readonly signal?: AbortSignal;
}

/** One model-suggested adjustment. */
export interface LiteRtAdjustmentSuggestion {
  /** Existing Image Studio adjustment channel to apply. */
  readonly channel: ImageAdjustmentChannel;
  /** Normalized adjustment value. */
  readonly value: number;
  /** Optional confidence score from post-processing. */
  readonly confidence?: number;
}

/** Smart Enhance result consumed by Image Studio's generic AI panel. */
export interface LiteRtSmartEnhanceResult {
  /** Undo/history label for the operation stack. */
  readonly label: string;
  /** Model-generated adjustments to apply as one transaction. */
  readonly adjustments: readonly LiteRtAdjustmentSuggestion[];
  /** Model label used for UI diagnostics. */
  readonly model?: string;
  /** Accelerator requested when compiling the model. */
  readonly accelerator?: LiteRtAccelerator;
}

/** Status displayed by the generic Studio AI Tools panel. */
export interface LiteRtAiStatus {
  /** True when the provider has enough configuration to run at least one task. */
  readonly available: boolean;
  /** Short status label such as `Ready`, `Model missing`, or `Runtime error`. */
  readonly label: string;
  /** Optional details for setup or runtime diagnostics. */
  readonly detail?: string;
  /** Runtime accelerator associated with this provider. */
  readonly accelerator?: LiteRtAccelerator;
}

/** Generic provider shape accepted structurally by Image Studio. */
export interface LiteRtAiProvider {
  /** Reads availability without forcing model execution. */
  getStatus(): Promise<LiteRtAiStatus> | LiteRtAiStatus;
  /** Runs Smart Enhance and returns existing adjustment operations to apply. */
  smartEnhance?(request: LiteRtSmartEnhanceRequest): Promise<LiteRtSmartEnhanceResult>;
  /** Releases runtime and model resources. */
  dispose?(): void;
}

/** Host options for creating an Image Studio-compatible LiteRT provider. */
export interface LiteRtImageAiProviderOptions extends LiteRtRuntimeOptions {
  /** Optional Smart Enhance model configuration. */
  readonly smartEnhance?: LiteRtSmartEnhanceSpec;
}

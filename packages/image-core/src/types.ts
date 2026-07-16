/**
 * Canonical npm name of the framework-agnostic image editing engine.
 */
export const IMAGE_CORE_PACKAGE_NAME = '@richly/image-core';

/** Rectangle in source-image pixel coordinates. */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Integer pixel dimensions after committed operations are reduced. */
export interface Size {
  readonly width: number;
  readonly height: number;
}

/** Source metadata exposed in immutable session snapshots. */
export interface SourceInfo extends Size {
  readonly mimeType?: string;
  readonly ref?: string;
  readonly fingerprint?: string;
}

/**
 * Explicit source input accepted by the core package.
 *
 * React and Studio packages may normalize friendlier host values, but core
 * keeps ownership and lifetime choices visible at the boundary.
 */
export type ImageSourceInput =
  | {
      readonly kind: 'blob';
      readonly blob: Blob;
      readonly ref?: string;
      readonly fingerprint?: string;
    }
  | {
      readonly kind: 'url';
      readonly url: string;
      readonly ref?: string;
      readonly fingerprint?: string;
    }
  | {
      readonly kind: 'imageData';
      readonly data: ImageData;
      readonly mimeType?: string;
      readonly ref?: string;
    }
  | {
      readonly kind: 'bitmap';
      readonly bitmap: ImageBitmap;
      readonly transferOwnership?: boolean;
      readonly mimeType?: string;
      readonly ref?: string;
    };

/** Immutable operation shape used both in memory and serialized documents. */
export interface ImageOperation<TType extends string = string, TParams = Record<string, unknown>> {
  readonly id: string;
  readonly type: TType;
  readonly version: number;
  readonly params: TParams;
}

/** Serialized non-destructive edit document. History and UI state are excluded. */
export interface ImageEditDocument {
  readonly schemaVersion: 1;
  readonly source: SourceInfo;
  readonly operations: ImageOperation[];
  readonly metadata?: Record<string, unknown>;
}

/** Public history entry summary. Historical manifests remain session-internal. */
export interface HistoryEntrySummary {
  readonly id: string;
  readonly label: string;
  readonly timestamp: number;
}

/** Immutable snapshot consumed by hosts and React external-store selectors. */
export interface ImageSessionState {
  readonly status: 'ready' | 'destroyed';
  readonly source: SourceInfo;
  readonly operations: readonly ImageOperation[];
  readonly transient: ImageOperation | null;
  readonly outputWidth: number;
  readonly outputHeight: number;
  readonly history: {
    readonly entries: readonly HistoryEntrySummary[];
    readonly index: number;
    readonly canUndo: boolean;
    readonly canRedo: boolean;
  };
  readonly dirty: boolean;
  readonly revision: number;
}

/** Validation result returned by dry-run command checks and preview calls. */
export type ValidationResult =
  { readonly ok: true } | { readonly ok: false; readonly code: string; readonly message: string };

/** Mutation result returned by committed session commands. */
export type CommandResult =
  | {
      readonly ok: true;
      readonly operation?: ImageOperation;
      readonly removedOperationIds?: readonly string[];
    }
  | { readonly ok: false; readonly code: string; readonly message: string };

/** Built-in command parameter map. External command keys may be added by plugins. */
export interface ImageCommandMap {
  readonly crop: { readonly rect: Rect };
  readonly resize: { readonly width: number; readonly height: number };
  readonly rotate: { readonly angle: number };
  readonly flip: { readonly axis: 'horizontal' | 'vertical' };
}

/** Render stage descriptor returned by operation definitions. */
export interface RenderStage<TParams = unknown> {
  readonly type: string;
  readonly version: number;
  readonly params: TParams;
}

/** Contract implemented by built-in and external operation definitions. */
export interface OperationDefinition<TParams = unknown> {
  readonly type: string;
  readonly version: number;
  validateParams(params: unknown): ValidationResult;
  reduceSize(input: Size, params: TParams): Size;
  createStage(params: TParams): RenderStage<TParams>;
  serializeParams?(params: TParams): Record<string, unknown>;
  deserializeParams?(value: Record<string, unknown>): TParams;
}

/** Target that a preview handle will render into once a renderer is attached. */
export interface PreviewTarget {
  readonly kind: 'canvas' | 'custom';
  readonly canvas?: HTMLCanvasElement | OffscreenCanvas;
}

/** Preview rendering options. Phase 2 keeps a fake renderer behind this API. */
export interface PreviewOptions {
  readonly maxDimension?: number;
  readonly signal?: AbortSignal;
}

/** Lightweight preview frame metadata shared by fake and real renderers. */
export interface PreviewFrame extends Size {
  readonly revision: number;
  readonly operations: readonly ImageOperation[];
  readonly blob?: Blob;
}

/** Disposable preview subscription/render handle. */
export interface PreviewHandle {
  readonly target: PreviewTarget;
  getFrame(): PreviewFrame;
  render(): Promise<PreviewFrame>;
  renderBefore(): Promise<PreviewFrame>;
  dispose(): void;
}

/** Export options for full-resolution output. */
export interface ExportOptions {
  readonly type?: 'image/png' | 'image/jpeg' | 'image/webp';
  readonly quality?: number;
  readonly maxWidth?: number;
  readonly maxHeight?: number;
  readonly signal?: AbortSignal;
}

/** Export result returned to Studio save flows. */
export interface ExportResult extends Size {
  readonly blob: Blob;
  readonly mimeType: string;
}

/** Compiled render plan shared by preview and full-resolution export. */
export interface RenderPlan extends Size {
  readonly source: SourceInfo;
  readonly operations: readonly ImageOperation[];
  readonly stages: readonly RenderStage[];
}

/** Result returned by render engines. */
export interface RenderResult extends Size {
  readonly blob?: Blob;
}

/** Resolved source data held by the session. */
export interface DecodedImageSource {
  readonly info: SourceInfo;
  readonly imageData?: ImageData;
  readonly bitmap?: ImageBitmap;
  destroy(): void;
}

/** Host-provided source decoder used in tests, workers, or non-browser hosts. */
export type ImageSourceDecoder = (source: ImageSourceInput) => Promise<DecodedImageSource>;

/** Rendering backend used by previews and exports. */
export interface RenderEngine {
  renderPreview(
    source: DecodedImageSource,
    plan: RenderPlan,
    target: PreviewTarget,
    options?: PreviewOptions
  ): Promise<RenderResult>;
  export(
    source: DecodedImageSource,
    plan: RenderPlan,
    options?: ExportOptions
  ): Promise<ExportResult>;
}

/** Session construction options and extension points. */
export interface ImageSessionOptions {
  readonly decoder?: ImageSourceDecoder;
  readonly renderEngine?: RenderEngine;
  readonly operations?: readonly OperationDefinition[];
  readonly idGenerator?: () => string;
  readonly now?: () => number;
  readonly metadata?: Record<string, unknown>;
}

/** Public non-destructive editing session API. */
export interface ImageSession {
  getState(): ImageSessionState;
  subscribe(listener: () => void): () => void;
  execute<K extends keyof ImageCommandMap>(command: K, params: ImageCommandMap[K]): CommandResult;
  canExecute<K extends keyof ImageCommandMap>(
    command: K,
    params: ImageCommandMap[K]
  ): ValidationResult;
  transact(label: string, execute: () => void): CommandResult;
  preview<K extends keyof ImageCommandMap>(
    command: K,
    params: ImageCommandMap[K]
  ): ValidationResult;
  commitPreview(): CommandResult;
  cancelPreview(): void;
  undo(): boolean;
  redo(): boolean;
  jumpToHistory(index: number): boolean;
  removeOperation(id: string): CommandResult;
  reset(): CommandResult;
  toDocument(): ImageEditDocument;
  createPreview(target: PreviewTarget, options?: PreviewOptions): PreviewHandle;
  export(options?: ExportOptions): Promise<ExportResult>;
  destroy(): void;
}

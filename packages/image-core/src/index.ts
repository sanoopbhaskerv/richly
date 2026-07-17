/**
 * @richly/image-core — framework-agnostic non-destructive image editing.
 *
 * Core owns source decoding, operation validation, immutable session state,
 * transient previews, history, serialization, cancellation, and resource
 * disposal. React and Studio packages own UI interaction state.
 *
 * @packageDocumentation
 */

export { createImageSession, restoreImageSession } from './session';
export { IMAGE_CORE_PACKAGE_NAME } from './types';
export {
  IMAGE_ADJUSTMENT_CHANNELS,
  IMAGE_ADJUSTMENT_SPECS,
  isImageAdjustmentChannel
} from './adjustments';
export type {
  CommandResult,
  DecodedImageSource,
  ExportOptions,
  ExportResult,
  HistoryEntrySummary,
  ImageAdjustmentChannel,
  ImageAdjustmentParams,
  ImageCommandMap,
  ImageEditDocument,
  ImageOperation,
  ImageSession,
  ImageSessionOptions,
  ImageSessionState,
  ImageSourceDecoder,
  ImageSourceInput,
  OperationDefinition,
  PreviewFrame,
  PreviewHandle,
  PreviewOptions,
  PreviewTarget,
  Rect,
  RenderEngine,
  RenderPlan,
  RenderResult,
  RenderStage,
  Size,
  SourceInfo,
  ValidationResult
} from './types';
export {
  ImageCoreError,
  ImageOperationRegistryError,
  ImageSessionDestroyedError,
  ImageSourceDecodeError
} from './errors';

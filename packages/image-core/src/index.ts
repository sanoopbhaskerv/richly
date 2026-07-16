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
export type {
  CommandResult,
  DecodedImageSource,
  ExportOptions,
  ExportResult,
  HistoryEntrySummary,
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

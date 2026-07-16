/**
 * @richly/image-react — React primitives for Richly Image Studio.
 *
 * React owns interaction state, viewport state, gestures, and accessibility
 * primitives while image-core remains the only owner of document state.
 *
 * @packageDocumentation
 */

import { IMAGE_CORE_PACKAGE_NAME } from '@richly/image-core';
export { IMAGE_REACT_PACKAGE_NAME } from './types';
export const IMAGE_REACT_UPSTREAM_PACKAGES = [IMAGE_CORE_PACKAGE_NAME] as const;

export { ImageEditorProvider, useImageEditor } from './context';
export {
  useCropTool,
  useImageCommands,
  useImageEditorState,
  useImageEditorUiState,
  useImageExport,
  useImageHistory,
  useViewport
} from './hooks';
export { ImageCanvas } from './ImageCanvas';
export { CropOverlay } from './CropOverlay';
export {
  clampRect,
  createCenteredCrop,
  createFullCrop,
  isFullCrop,
  moveCrop,
  pointerDeltaToImageDelta,
  resizeCrop
} from './cropGeometry';
export { ImageSlider, ImageToolbarButton } from './controls';
export { createImageEditorUiStore } from './uiStore';
export type { CropHandle, CropRect } from './cropGeometry';
export type {
  CropDraftState,
  ExportStatusState,
  ImageCommandHelpers,
  ImageEditorProviderProps,
  ImageEditorUiState,
  ImageTool,
  ViewportState
} from './types';

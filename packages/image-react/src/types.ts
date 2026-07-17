import type { ReactNode } from 'react';
import type {
  ImageAdjustmentChannel,
  ImageEditDocument,
  ImageSession,
  ImageSourceInput,
  Size
} from '@richly/image-core';

/** Canonical npm name of the React image primitives package. */
export const IMAGE_REACT_PACKAGE_NAME = '@richly/image-react';

/** Tool identifiers owned by the React interaction layer. */
export type ImageTool = 'adjust' | 'filters' | 'crop' | 'transform' | 'ai';

/** Viewport state is UI-only and never enters the image manifest. */
export interface ViewportState {
  readonly zoom: number;
  readonly panX: number;
  readonly panY: number;
  readonly fit: boolean;
}

/** Crop draft state owned by React until explicitly committed. */
export interface CropDraftState {
  readonly rect: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  } | null;
  /** Coordinate space used while transient crop previews shrink session output. */
  readonly bounds: Size | null;
  readonly aspectRatio: number | null;
}

/** Export lifecycle presentation state for UI controls. */
export interface ExportStatusState {
  readonly busy: boolean;
  readonly error: string | null;
}

/** Complete React-local interaction snapshot. */
export interface ImageEditorUiState {
  readonly activeTool: ImageTool;
  readonly viewport: ViewportState;
  readonly crop: CropDraftState;
  readonly compareMode: boolean;
  readonly exportStatus: ExportStatusState;
  readonly interactionError: string | null;
}

/** Provider props for session creation, restoration, and controlled hosts. */
export interface ImageEditorProviderProps {
  readonly session?: ImageSession;
  readonly source?: ImageSourceInput;
  readonly editDocument?: ImageEditDocument;
  readonly onDocumentChange?: (document: ImageEditDocument) => void;
  readonly onReady?: (session: ImageSession) => void;
  readonly onError?: (error: unknown) => void;
  readonly children: ReactNode;
}

/** Stable command helpers exposed by `useImageCommands`. */
export interface ImageCommandHelpers {
  crop(rect: NonNullable<CropDraftState['rect']>): void;
  resize(width: number, height: number): void;
  rotate(angle: number): void;
  flip(axis: 'horizontal' | 'vertical'): void;
  adjust(channel: ImageAdjustmentChannel, value: number): void;
}

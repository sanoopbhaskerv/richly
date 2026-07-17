import type {
  ImageAdjustmentChannel,
  ImageEditDocument,
  ImageSession,
  ImageSourceInput
} from '@richly/image-core';
import type { ImageTool } from '@richly/image-react';
import type { ImageStudioResult } from './controller';

/** Canonical package name for the complete Studio UI package. */
export const IMAGE_STUDIO_PACKAGE_NAME = '@richly/image-studio';

/** Visual theme supported by the reusable Studio shell. */
export type ImageStudioTheme = 'dark' | 'light';

/** Runtime status surfaced by optional Image Studio AI providers. */
export interface ImageStudioAiStatus {
  /** Whether at least one AI task is configured and available. */
  readonly available: boolean;
  /** Short human-readable status shown in the AI Tools panel. */
  readonly label: string;
  /** Optional setup or runtime diagnostic details. */
  readonly detail?: string;
  /** Accelerator requested or used by the provider, for example `webgpu`. */
  readonly accelerator?: string;
}

/** Image pixels passed from Studio into an AI editing task. */
export interface ImageStudioAiImageRequest {
  /** Current rendered image pixels, downscaled by Studio for interactive inference. */
  readonly imageData: ImageData;
  /** Cancellation signal owned by the AI Tools panel. */
  readonly signal: AbortSignal;
}

/** One AI-suggested adjustment using an existing Image Studio adjustment channel. */
export interface ImageStudioAiAdjustmentSuggestion {
  /** Existing image-core adjustment channel to apply. */
  readonly channel: ImageAdjustmentChannel;
  /** Normalized adjustment value. */
  readonly value: number;
  /** Optional model confidence for UI diagnostics. */
  readonly confidence?: number;
}

/** Result of an AI task that maps onto existing non-destructive adjustments. */
export interface ImageStudioAiAdjustmentResult {
  /** Undo/history label for the transaction. */
  readonly label: string;
  /** Suggested adjustments applied only after the user confirms the task. */
  readonly adjustments: readonly ImageStudioAiAdjustmentSuggestion[];
  /** Optional model label displayed after the task runs. */
  readonly model?: string;
  /** Optional accelerator label displayed after the task runs. */
  readonly accelerator?: string;
}

/** Optional host-provided AI task runner used by the Studio AI Tools panel. */
export interface ImageStudioAiProvider {
  /** Reads provider availability without applying edits. */
  getStatus?(): ImageStudioAiStatus | Promise<ImageStudioAiStatus>;
  /** Runs Smart Enhance and returns adjustments that Studio applies as one transaction. */
  smartEnhance?(request: ImageStudioAiImageRequest): Promise<ImageStudioAiAdjustmentResult>;
  /** Releases provider resources when the hosting app tears Studio down. */
  dispose?(): void;
}

/** Props for the complete responsive Image Studio component. */
export interface ImageStudioProps {
  /** Controlled image session supplied by advanced hosts. */
  readonly session?: ImageSession;
  /** Source used when the provider should create its own image session. */
  readonly source?: ImageSourceInput;
  /** Serialized edit manifest restored with the source. */
  readonly editDocument?: ImageEditDocument;
  /** Initial alt text shown in the export flow. */
  readonly initialAlt?: string;
  /** Suggested filename returned with the export result. */
  readonly suggestedFilename?: string;
  /** Visual theme for the Studio shell. */
  readonly theme?: ImageStudioTheme;
  /** Tool activated when Studio opens; hosts deep-link Crop/Transform/Adjust. */
  readonly initialTool?: ImageTool;
  /** Host layout mode; modal hosts can use this for outer presentation. */
  readonly mode?: 'inline' | 'modal';
  /** Optional local AI provider, commonly backed by LiteRT.js in host apps. */
  readonly aiProvider?: ImageStudioAiProvider;
  /** Optional host callback for adding or replacing the current project image. */
  readonly onAddImage?: () => void;
  /** Called with rendered bytes and the edit manifest when export succeeds. */
  readonly onSave?: (result: ImageStudioResult) => void;
  /** Called when the user cancels or closes Studio. */
  readonly onCancel?: () => void;
  /** Receives session creation or export errors surfaced by child providers. */
  readonly onError?: (error: unknown) => void;
}

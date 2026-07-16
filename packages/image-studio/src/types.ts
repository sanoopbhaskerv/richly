import type { ImageEditDocument, ImageSession, ImageSourceInput } from '@richly/image-core';
import type { ImageStudioResult } from './controller';

/** Canonical package name for the complete Studio UI package. */
export const IMAGE_STUDIO_PACKAGE_NAME = '@richly/image-studio';

/** Visual theme supported by the reusable Studio shell. */
export type ImageStudioTheme = 'dark' | 'light';

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
  /** Host layout mode; modal hosts can use this for outer presentation. */
  readonly mode?: 'inline' | 'modal';
  /** Called with rendered bytes and the edit manifest when export succeeds. */
  readonly onSave?: (result: ImageStudioResult) => void;
  /** Called when the user cancels or closes Studio. */
  readonly onCancel?: () => void;
  /** Receives session creation or export errors surfaced by child providers. */
  readonly onError?: (error: unknown) => void;
}

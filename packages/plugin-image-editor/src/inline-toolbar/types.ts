/**
 * Public option and state types for the nested Richly image inline toolbar.
 */

import type { ImageSession, ImageSessionOptions, ImageSourceInput } from '@richly/image-core';
import type {
  ImageEditorContext,
  ImageEditorOpenInput,
  ImageEditorResult,
  PersistedImageEdit
} from '../shared';

/** Toolbar content mode. The toolbar morphs in place between these modes. */
export type ImageToolbarMode = 'root' | 'transform' | 'adjust';

/** Quick adjustments exposed as compact slider popovers. */
export type ImageAdjustmentKind = 'brightness' | 'contrast' | 'saturation';

/** Actions that may appear on the root toolbar, in display order. */
export type ImageToolbarRootAction =
  'align' | 'crop' | 'transform' | 'adjust' | 'studio' | 'alt' | 'replace' | 'more' | 'delete';

/** Input passed to the host `openEditor` callback with a requested entry tool. */
export type ImageInlineToolbarOpenInput = ImageEditorOpenInput & {
  /** Tool Image Studio should activate when it opens. */
  readonly initialTool?: 'crop' | 'transform' | 'adjust';
  /** Panel focused inside the initial tool; only `resize` is defined today. */
  readonly initialPanel?: 'resize';
};

/** Options for {@link imageInlineToolbarPlugin}. */
export interface ImageInlineToolbarOptions {
  /** Master switch; a disabled toolbar installs nothing. Default true. */
  readonly enabled?: boolean;
  /** Root actions to render, in order. Defaults to every action except `delete`
   *  (Delete lives inside the More menu by default). */
  readonly rootActions?: readonly ImageToolbarRootAction[];
  /** Enables the headless quick Transform sub-toolbar. Default true. */
  readonly quickTransform?: boolean;
  /** Enables the headless quick Adjust sub-toolbar. Default true. */
  readonly quickAdjust?: boolean;
  /** Enables the inline centered-crop popover. Default true. */
  readonly quickCrop?: boolean;
  /** Opens the full Image Studio; omitted hosts lose Studio/Resize entries. */
  readonly openEditor?: (
    input: ImageInlineToolbarOpenInput,
    context: ImageEditorContext
  ) => Promise<ImageEditorResult | null>;
  /** Persists exported quick-edit bytes before Richly HTML is changed. */
  readonly persist?: (
    result: ImageEditorResult,
    context: ImageEditorContext
  ) => Promise<PersistedImageEdit>;
  /** Receives quick-edit, launch, persistence, or mutation errors. */
  readonly onError?: (error: unknown, context?: ImageEditorContext) => void;
  /** Creates the headless session for quick edits. Hosts may inject custom
   *  decoders/render engines; tests inject fakes. Defaults to image-core. */
  readonly createSession?: (
    source: ImageSourceInput,
    options?: ImageSessionOptions
  ) => Promise<ImageSession>;
  /** Editor-container width (px) below which the compact bottom bar is used. */
  readonly compactBreakpoint?: number;
}

/** Root actions rendered when the host does not narrow the list. */
export const DEFAULT_ROOT_ACTIONS: readonly ImageToolbarRootAction[] = [
  'align',
  'crop',
  'transform',
  'adjust',
  'studio',
  'alt',
  'replace',
  'more'
];

/** Default editor-container width breakpoint for the compact layout. */
export const DEFAULT_COMPACT_BREAKPOINT = 560;

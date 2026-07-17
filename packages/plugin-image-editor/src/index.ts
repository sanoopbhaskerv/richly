/**
 * @richly/plugin-image-editor — optional Richly bridge to host-provided image editors.
 *
 * @packageDocumentation
 */

import type { Editor, Plugin } from '@richly/core';
import {
  applyPersistedEdit,
  captureImageContext,
  currentImage,
  ImageEditorSelectionError
} from './shared';
import type {
  ImageEditorContext,
  ImageEditorOpenInput,
  ImageEditorResult,
  PersistedImageEdit
} from './shared';

export { ImageEditorSelectionError } from './shared';
export type {
  ImageEditorContext,
  ImageEditorOpenInput,
  ImageEditorResult,
  ImageEditorSourceInput,
  PersistedImageEdit
} from './shared';
export {
  imageInlineToolbarPlugin,
  IMAGE_INLINE_TOOLBAR_PLUGIN_NAME
} from './inline-toolbar/controller';
export type {
  ImageInlineToolbarOpenInput,
  ImageInlineToolbarOptions,
  ImageToolbarMode,
  ImageToolbarRootAction,
  ImageAdjustmentKind
} from './inline-toolbar/types';

/** Canonical npm name of this package. */
export const PLUGIN_IMAGE_EDITOR_PACKAGE_NAME = '@richly/plugin-image-editor';

/** Stable command and toolbar identifier for the advanced image editing action. */
export const IMAGE_EDIT_ACTION_NAME = 'imageedit';

/** Options for creating the optional Richly `imageedit` plugin. */
export interface ImageEditorPluginOptions {
  /** Opens the host editor; resolving null means cancel and causes no DOM mutation. */
  readonly openEditor: (
    input: ImageEditorOpenInput,
    context: ImageEditorContext
  ) => Promise<ImageEditorResult | null>;
  /** Persists editor output before Richly HTML is changed. */
  readonly persist: (
    result: ImageEditorResult,
    context: ImageEditorContext
  ) => Promise<PersistedImageEdit>;
  /** Resolves a host-owned edit manifest for the selected image. */
  readonly resolveEditDocument?: (context: ImageEditorContext) => unknown | Promise<unknown>;
  /** Derives a filename hint for the host editor. */
  readonly getSuggestedFilename?: (context: ImageEditorContext) => string | undefined;
  /** Receives selection, async launch, persistence, or mutation errors. */
  readonly onError?: (error: unknown, context?: ImageEditorContext) => void;
}

function createImageEditorContext(
  editor: Editor,
  options: ImageEditorPluginOptions
): ImageEditorContext | null {
  const context = captureImageContext(editor);
  if (!context) options.onError?.(new ImageEditorSelectionError());
  return context;
}

async function openHostEditor(
  options: ImageEditorPluginOptions,
  context: ImageEditorContext
): Promise<ImageEditorResult | null> {
  const input: ImageEditorOpenInput = {
    source: { kind: 'url', url: context.sourceUrl },
    editDocument: await options.resolveEditDocument?.(context),
    alt: context.alt,
    suggestedFilename: options.getSuggestedFilename?.(context)
  };
  return options.openEditor(input, context);
}

async function persistAndApplyEdit(
  options: ImageEditorPluginOptions,
  result: ImageEditorResult,
  context: ImageEditorContext
): Promise<void> {
  const persisted = await options.persist(result, context);
  if (!context.image.isConnected) return;

  context.editor.selection.moveToBookmark(context.bookmark);
  // The command itself uses skipUndo because the editor launch is async.
  // Capture the undo level only after persistence succeeds and immediately
  // before mutating the selected image.
  context.editor.undoManager.snapshot();
  applyPersistedEdit(context.image, persisted);
  context.editor.events.emit('change', context.editor.getContent());
}

async function runImageEdit(editor: Editor, options: ImageEditorPluginOptions): Promise<void> {
  const context = createImageEditorContext(editor, options);
  if (!context) return;

  try {
    const result = await openHostEditor(options, context);
    if (!result || !context.image.isConnected) return;
    await persistAndApplyEdit(options, result, context);
  } catch (error) {
    options.onError?.(error, context);
  }
}

/** Creates the optional `imageedit` Richly plugin. */
export function imageEditorPlugin(options: ImageEditorPluginOptions): Plugin {
  return {
    name: IMAGE_EDIT_ACTION_NAME,
    init(editor) {
      editor.commands.register(IMAGE_EDIT_ACTION_NAME, {
        skipUndo: true,
        execute: (ed) => {
          void runImageEdit(ed, options);
        },
        queryState: (ed) => currentImage(ed) !== null
      });
      editor.ui.addButton(IMAGE_EDIT_ACTION_NAME, {
        icon: 'image',
        tooltip: 'Edit image',
        command: IMAGE_EDIT_ACTION_NAME
      });
      editor.ui.addMenuItem(IMAGE_EDIT_ACTION_NAME, {
        menu: 'insert',
        text: 'Edit image…',
        command: IMAGE_EDIT_ACTION_NAME
      });
    }
  };
}

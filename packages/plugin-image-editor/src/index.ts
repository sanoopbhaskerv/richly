/**
 * @richly/plugin-image-editor — optional Richly bridge to host-provided image editors.
 *
 * @packageDocumentation
 */

import type { Bookmark, Editor, Plugin } from '@richly/core';

/** Canonical npm name of this package. */
export const PLUGIN_IMAGE_EDITOR_PACKAGE_NAME = '@richly/plugin-image-editor';

/** Stable command and toolbar identifier for the advanced image editing action. */
export const IMAGE_EDIT_ACTION_NAME = 'imageedit';

/** Source shape passed to host editors such as `@richly/image-studio/controller`. */
export interface ImageEditorSourceInput {
  /** URL currently stored on the selected Richly image. */
  readonly kind: 'url';
  /** Absolute, relative, object, or data URL read from the selected image. */
  readonly url: string;
}

/** Input sent to the host-provided editor opener. */
export interface ImageEditorOpenInput {
  /** Selected image source to load into the editor. */
  readonly source: ImageEditorSourceInput;
  /** Host-owned edit manifest restored by the editor, if available. */
  readonly editDocument?: unknown;
  /** Current alt text from the selected Richly image. */
  readonly alt?: string;
  /** Optional filename hint derived from the selected image. */
  readonly suggestedFilename?: string;
}

/** Save result returned by the host-provided editor. */
export interface ImageEditorResult {
  /** Rendered image bytes. */
  readonly blob: Blob;
  /** Rendered image width in CSS pixels. */
  readonly width: number;
  /** Rendered image height in CSS pixels. */
  readonly height: number;
  /** MIME type of the rendered Blob. */
  readonly mimeType: string;
  /** Host-owned edit manifest; the plugin never serializes it into Richly HTML. */
  readonly editDocument: unknown;
  /** Final alt text chosen in the editor. */
  readonly alt?: string;
  /** Suggested filename returned by the editor. */
  readonly suggestedFilename?: string;
}

/** Immutable context captured before asynchronous editor work begins. */
export interface ImageEditorContext {
  /** Richly editor instance receiving the eventual DOM update. */
  readonly editor: Editor;
  /** Original selected image element, used only if it is still connected. */
  readonly image: HTMLImageElement;
  /** Current `src` read from the selected image. */
  readonly sourceUrl: string;
  /** Current `alt` read from the selected image. */
  readonly alt: string;
  /** Selection bookmark captured before focus leaves Richly. */
  readonly bookmark: Bookmark | null;
}

/** Persisted asset information applied back to the Richly image element. */
export interface PersistedImageEdit {
  /** URL/reference that replaces the selected image `src`. */
  readonly src: string;
  /** Optional alt text override; null removes the attribute. */
  readonly alt?: string | null;
  /** Optional display width override; null removes the attribute. */
  readonly width?: number | string | null;
  /** Optional display height override; null removes the attribute. */
  readonly height?: number | string | null;
  /** Optional host-owned edit manifest reference, not the manifest itself. */
  readonly editDocumentRef?: string | null;
  /** Additional safe image attributes such as `data-asset-id`. */
  readonly attributes?: Record<string, string | number | boolean | null | undefined>;
}

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

/** Error thrown when the action runs without a selected image. */
export class ImageEditorSelectionError extends Error {
  constructor() {
    super('Select an image before running imageedit');
    this.name = 'ImageEditorSelectionError';
  }
}

function currentImage(editor: Editor): HTMLImageElement | null {
  const range = editor.selection.getRange();
  if (!range) return null;
  const node = range.startContainer;
  if (node.nodeType === Node.ELEMENT_NODE) {
    const child = (node as HTMLElement).childNodes[range.startOffset];
    if (child instanceof HTMLImageElement) return child;
  }
  return node.parentElement?.closest('img') as HTMLImageElement | null;
}

function setOptionalAttribute(
  image: HTMLImageElement,
  name: string,
  value: string | number | boolean | null | undefined
): void {
  if (value === undefined) return;
  if (value === null || value === false) {
    image.removeAttribute(name);
    return;
  }
  image.setAttribute(name, String(value));
}

function applyPersistedEdit(image: HTMLImageElement, persisted: PersistedImageEdit): void {
  image.setAttribute('src', persisted.src);
  setOptionalAttribute(image, 'alt', persisted.alt);
  setOptionalAttribute(image, 'width', persisted.width);
  setOptionalAttribute(image, 'height', persisted.height);
  setOptionalAttribute(image, 'data-rly-image-edit-ref', persisted.editDocumentRef);
  for (const [name, value] of Object.entries(persisted.attributes ?? {})) {
    if (!/^(data-[\w:-]+|loading|decoding|crossorigin|referrerpolicy)$/i.test(name)) continue;
    setOptionalAttribute(image, name, value);
  }
}

function createImageEditorContext(
  editor: Editor,
  options: ImageEditorPluginOptions
): ImageEditorContext | null {
  const image = currentImage(editor);
  const sourceUrl = image?.getAttribute('src')?.trim() ?? '';
  if (!image || !sourceUrl || image.hasAttribute('data-rly-uploading')) {
    options.onError?.(new ImageEditorSelectionError());
    return null;
  }

  return {
    editor,
    image,
    sourceUrl,
    alt: image.getAttribute('alt') ?? '',
    bookmark: editor.selection.getBookmark()
  };
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

/**
 * Shared contracts and DOM helpers used by both the `imageedit` bridge and
 * the inline image toolbar. Kept dependency-free (only `@richly/core` types)
 * so every entry point of this package stays host-editor agnostic.
 */

import type { Bookmark, Editor } from '@richly/core';

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

/** Error thrown when an image action runs without a selected image. */
export class ImageEditorSelectionError extends Error {
  constructor() {
    super('Select an image before running imageedit');
    this.name = 'ImageEditorSelectionError';
  }
}

/** Resolves the image element addressed by the current Richly selection. */
export function currentImage(editor: Editor): HTMLImageElement | null {
  const range = editor.selection.getRange();
  if (!range) return null;
  const node = range.startContainer;
  if (node.nodeType === Node.ELEMENT_NODE) {
    const child = (node as HTMLElement).childNodes[range.startOffset];
    if (child instanceof HTMLImageElement) return child;
  }
  return node.parentElement?.closest('img') as HTMLImageElement | null;
}

/** Applies, replaces, or removes one optional image attribute. */
export function setOptionalAttribute(
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

/** Writes a persisted edit back onto the selected Richly image element. */
export function applyPersistedEdit(image: HTMLImageElement, persisted: PersistedImageEdit): void {
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

/** Captures an immutable editing context for the currently selected image. */
export function captureImageContext(editor: Editor): ImageEditorContext | null {
  const image = currentImage(editor);
  const sourceUrl = image?.getAttribute('src')?.trim() ?? '';
  if (!image || !sourceUrl || image.hasAttribute('data-rly-uploading')) return null;
  return {
    editor,
    image,
    sourceUrl,
    alt: image.getAttribute('alt') ?? '',
    bookmark: editor.selection.getBookmark()
  };
}

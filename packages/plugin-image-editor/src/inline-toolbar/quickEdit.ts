/**
 * Headless quick-edit engine for the inline image toolbar.
 *
 * Immediate actions (rotate/flip) and adjust drafts share one commit path:
 * export → persist → revalidate target → one undo snapshot → mutate the
 * image → one change event. Persistence always completes before any Richly
 * mutation so a failed host persist leaves the document untouched.
 */

import { createImageSession } from '@richly/image-core';
import type { ImageOperation, ImageSession } from '@richly/image-core';
import { applyPersistedEdit } from '../shared';
import type { ImageEditorContext, ImageEditorResult, PersistedImageEdit } from '../shared';
import type { ImageAdjustmentKind, ImageInlineToolbarOptions } from './types';

/** Immediate transform operations offered on the Transform sub-toolbar. */
export type QuickTransformKind =
  'rotate-left' | 'rotate-right' | 'flip-horizontal' | 'flip-vertical';

/** Centered crop presets exposed by the inline crop popover. */
export type QuickCropPreset = 'square' | 'portrait' | 'landscape' | 'wide';

type DisplayDimensionMode = 'preserve' | 'swap' | 'rendered';

/** Error thrown when the targeted image changed or vanished mid-operation. */
export class ImageQuickEditStaleTargetError extends Error {
  constructor() {
    super('The selected image changed before the edit could be applied');
    this.name = 'ImageQuickEditStaleTargetError';
  }
}

export interface QuickEditDeps {
  readonly options: ImageInlineToolbarOptions;
  /** Signal aborted when the editor is destroyed or the toolbar torn down. */
  readonly signal: AbortSignal;
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');
}

async function openQuickSession(
  context: ImageEditorContext,
  deps: QuickEditDeps
): Promise<ImageSession> {
  const create = deps.options.createSession ?? createImageSession;
  return create({ kind: 'url', url: context.sourceUrl });
}

/** True while the captured target is still the image we measured. */
function targetIsCurrent(context: ImageEditorContext): boolean {
  return (
    context.image.isConnected &&
    context.editor.getBody().contains(context.image) &&
    (context.image.getAttribute('src') ?? '') === context.sourceUrl
  );
}

/**
 * Persists an editor/quick-edit result, then applies it to the target image.
 *
 * Ordering is deliberate: the host persists first; only a successful persist
 * is followed by exactly one undo snapshot, one image mutation, and one
 * change event. Any failure before the snapshot leaves document and history
 * untouched.
 */
export async function persistEditorResult(
  context: ImageEditorContext,
  result: ImageEditorResult,
  deps: QuickEditDeps,
  displayMode: DisplayDimensionMode = 'preserve'
): Promise<void> {
  const persist = deps.options.persist;
  if (!persist)
    throw new Error('imageInlineToolbarPlugin requires a persist callback for quick edits');

  const persisted = await persist(result, context);
  throwIfAborted(deps.signal);
  if (!targetIsCurrent(context)) throw new ImageQuickEditStaleTargetError();

  const display = displayOverride(context.image, persisted, result, displayMode);
  context.editor.selection.moveToBookmark(context.bookmark);
  context.editor.undoManager.snapshot();
  applyPersistedEdit(context.image, { ...persisted, ...display });
  context.editor.events.emit('change', context.editor.getContent());
}

/** Exports the session's committed operations and runs the persist pipeline. */
async function commitQuickEdit(
  context: ImageEditorContext,
  session: ImageSession,
  deps: QuickEditDeps,
  displayMode: DisplayDimensionMode
): Promise<void> {
  throwIfAborted(deps.signal);
  const exported = await session.export({ signal: deps.signal });
  const result: ImageEditorResult = {
    blob: exported.blob,
    width: exported.width,
    height: exported.height,
    mimeType: exported.mimeType,
    editDocument: session.toDocument(),
    alt: context.alt
  };
  await persistEditorResult(context, result, deps, displayMode);
}

/**
 * 90° rotations change the aspect ratio, so explicit display dimensions must
 * swap with the pixels or the rotated image renders distorted. Host-provided
 * dimensions always win; this only fills the gap when the host left them out.
 */
function displayOverride(
  image: HTMLImageElement,
  persisted: PersistedImageEdit,
  result: ImageEditorResult,
  mode: DisplayDimensionMode
): Pick<PersistedImageEdit, 'width' | 'height'> {
  if (mode === 'preserve' || persisted.width !== undefined || persisted.height !== undefined)
    return {};
  if (mode === 'rendered') return { width: result.width, height: result.height };
  const width = image.getAttribute('width');
  const height = image.getAttribute('height');
  if (!width && !height) return {};
  return { width: height ?? null, height: width ?? null };
}

/** Runs one immediate rotate/flip through a short-lived headless session. */
export async function runQuickTransform(
  context: ImageEditorContext,
  kind: QuickTransformKind,
  deps: QuickEditDeps
): Promise<void> {
  const session = await openQuickSession(context, deps);
  try {
    const result =
      kind === 'rotate-left' || kind === 'rotate-right'
        ? session.execute('rotate', { angle: kind === 'rotate-right' ? 90 : -90 })
        : session.execute('flip', {
            axis: kind === 'flip-horizontal' ? 'horizontal' : 'vertical'
          });
    if (!result.ok) throw new Error(result.message);
    await commitQuickEdit(context, session, deps, kind.startsWith('rotate') ? 'swap' : 'preserve');
  } finally {
    session.destroy();
  }
}

/** Runs a centered ratio crop through a short-lived headless session. */
export async function runQuickCrop(
  context: ImageEditorContext,
  preset: QuickCropPreset,
  deps: QuickEditDeps
): Promise<void> {
  const session = await openQuickSession(context, deps);
  try {
    const source = session.getState().source;
    const result = session.execute('crop', {
      rect: centeredCropRect(source.width, source.height, cropRatio(preset))
    });
    if (!result.ok) throw new Error(result.message);
    await commitQuickEdit(context, session, deps, 'rendered');
  } finally {
    session.destroy();
  }
}

function cropRatio(preset: QuickCropPreset): number {
  if (preset === 'portrait') return 4 / 5;
  if (preset === 'landscape') return 3 / 2;
  if (preset === 'wide') return 16 / 9;
  return 1;
}

function centeredCropRect(
  width: number,
  height: number,
  ratio: number
): { x: number; y: number; width: number; height: number } {
  const sourceRatio = width / height;
  const cropWidth = sourceRatio > ratio ? height * ratio : width;
  const cropHeight = sourceRatio > ratio ? height : width / ratio;
  return {
    x: Math.max(0, Math.round((width - cropWidth) / 2)),
    y: Math.max(0, Math.round((height - cropHeight) / 2)),
    width: Math.max(1, Math.round(cropWidth)),
    height: Math.max(1, Math.round(cropHeight))
  };
}

const PREVIEW_ATTRIBUTE = 'data-rly-adjust-preview';

/**
 * Mirrors image-core's Canvas2D adjustment math (see canvasEngine.ts) as a
 * CSS filter so the transient preview is visually equivalent to the eventual
 * export without re-rendering pixels on every slider input.
 */
function cssFilterFor(operations: readonly ImageOperation[]): string {
  const filters = operations
    .filter((operation) => operation.type === 'adjust')
    .map((operation) => {
      const { channel, value } = operation.params as { channel: string; value: number };
      if (channel === 'brightness') return `brightness(${Math.max(0, 1 + value)})`;
      if (channel === 'contrast') return `contrast(${Math.max(0, 1 + value)})`;
      if (channel === 'saturation') return `saturate(${Math.max(0, 1 + value)})`;
      return `grayscale(${value})`;
    });
  return filters.join(' ') || 'none';
}

/** Channel of the adjust draft; grayscale joins the slider channels here. */
export type AdjustDraftChannel = ImageAdjustmentKind | 'grayscale';

/**
 * One transient adjust interaction on the selected image.
 *
 * The draft owns exactly one headless session for the whole Adjust visit.
 * Slider movement only updates the session's transient operation plus a CSS
 * filter mirror on the image; nothing persists until `apply()`. The preview
 * filter lives in a plugin-owned <style> rule keyed by a transient marker
 * attribute, so serializable editor HTML never carries preview styling, and
 * `dispose()` always removes the marker. No object URLs are created.
 */
export class AdjustQuickDraft {
  private session: ImageSession | null = null;
  private readonly style: HTMLStyleElement;
  private currentChannel: AdjustDraftChannel | null = null;
  private currentValue = 0;
  private restoreValue = 0;
  private disposed = false;

  constructor(
    private readonly context: ImageEditorContext,
    private readonly deps: QuickEditDeps
  ) {
    const doc = context.image.ownerDocument;
    this.style = doc.createElement('style');
    doc.head.appendChild(this.style);
  }

  /** Starts (or switches to) a channel, keeping earlier channel drafts. */
  async begin(channel: AdjustDraftChannel): Promise<void> {
    if (this.disposed) throw new Error('Adjust draft already disposed');
    if (!this.session) {
      this.session = await openQuickSession(this.context, this.deps);
      if (this.disposed || this.deps.signal.aborted) {
        this.session.destroy();
        this.session = null;
        throwIfAborted(this.deps.signal);
        return;
      }
      this.context.image.setAttribute(PREVIEW_ATTRIBUTE, '');
    }
    if (this.currentChannel && this.currentChannel !== channel) {
      // Preserve the previous channel's draft inside the same session so
      // switching sliders keeps unapplied work until Apply or Cancel-all.
      this.session.commitPreview();
    }
    this.currentChannel = channel;
    // A committed in-session op for this channel would stack with the new
    // transient during rendering, so lift it back into the transient slot.
    const committed = this.committedOperation(channel);
    this.restoreValue = Math.round(((committed?.params as { value?: number })?.value ?? 0) * 100);
    if (committed) this.session.removeOperation(committed.id);
    this.preview(this.restoreValue);
  }

  /** Updates the transient preview; UI values are -100..100 (grayscale 0..100). */
  preview(value: number): void {
    if (!this.session || !this.currentChannel) return;
    this.currentValue = value;
    const normalized = value / 100;
    if (normalized === 0) this.session.cancelPreview();
    else this.session.preview('adjust', { channel: this.currentChannel, value: normalized });
    this.syncFilter();
  }

  /** Current UI value for the active channel. */
  value(): number {
    return this.currentValue;
  }

  /** True when any committed or transient adjustment is pending. */
  dirty(): boolean {
    if (!this.session) return false;
    const state = this.session.getState();
    return state.transient !== null || state.operations.length > 0;
  }

  /** Cancels only the active channel's movement, restoring its prior draft value. */
  cancelCurrent(): void {
    if (!this.session) return;
    this.preview(this.restoreValue);
  }

  /** Applies every drafted adjustment through the single-commit pipeline. */
  async apply(): Promise<void> {
    if (!this.session) return;
    this.session.commitPreview();
    if (this.session.getState().operations.length === 0) {
      this.dispose();
      return;
    }
    try {
      await commitQuickEdit(this.context, this.session, this.deps, 'preserve');
    } finally {
      this.dispose();
    }
  }

  /** Discards the whole draft; restores the original image, no history. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.context.image.removeAttribute(PREVIEW_ATTRIBUTE);
    this.style.remove();
    this.session?.destroy();
    this.session = null;
  }

  private committedOperation(channel: AdjustDraftChannel): ImageOperation | undefined {
    return this.session
      ?.getState()
      .operations.find(
        (operation) =>
          operation.type === 'adjust' &&
          (operation.params as { channel?: string }).channel === channel
      );
  }

  private syncFilter(): void {
    if (!this.session) return;
    const state = this.session.getState();
    const operations = state.transient ? [...state.operations, state.transient] : state.operations;
    this.style.textContent = `img[${PREVIEW_ATTRIBUTE}] { filter: ${cssFilterFor(operations)}; }`;
  }
}

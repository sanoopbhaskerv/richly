/**
 * @richly/image-studio/controller — React-free programmatic controller entry.
 *
 * Hosts use this subpath to open a Studio host lazily without importing React.
 *
 * @packageDocumentation
 */

import type { ImageEditDocument, ImageSourceInput } from '@richly/image-core';

/** Import specifier of the React-free controller entry point. */
export const IMAGE_STUDIO_CONTROLLER_ENTRY = '@richly/image-studio/controller';

/** Input accepted by the programmatic Studio controller. */
export interface ImageStudioOpenInput {
  /** Original media source to decode when Studio opens. */
  readonly source: ImageSourceInput;
  /** Optional serialized edit manifest to restore before editing. */
  readonly editDocument?: ImageEditDocument;
  /** Existing alt text the host wants Studio to preserve or edit. */
  readonly alt?: string;
  /** Suggested output filename passed back to the host on save. */
  readonly suggestedFilename?: string;
}

/** Save result returned by Image Studio. It never uploads automatically. */
export interface ImageStudioResult {
  /** Rendered image bytes for the selected export format. */
  readonly blob: Blob;
  /** Exported image width in CSS pixels. */
  readonly width: number;
  /** Exported image height in CSS pixels. */
  readonly height: number;
  /** MIME type of the rendered Blob. */
  readonly mimeType: string;
  /** Serialized edit manifest for future non-destructive restores. */
  readonly editDocument: ImageEditDocument;
  /** Final alt text collected by Studio. */
  readonly alt?: string;
  /** Suggested output filename echoed from the open request. */
  readonly suggestedFilename?: string;
}

/** Immutable controller snapshot consumed through external-store semantics. */
export interface ImageStudioControllerSnapshot {
  /** Whether Studio is currently waiting for a save or cancel result. */
  readonly open: boolean;
  /** Active open request input, or null when closed. */
  readonly input: ImageStudioOpenInput | null;
}

/** Error thrown when a second open request starts before the first settles. */
export class ImageStudioControllerBusyError extends Error {
  constructor() {
    super('Image Studio is already open');
    this.name = 'ImageStudioControllerBusyError';
  }
}

/** Error thrown when no Studio host subscribes before the open timeout elapses. */
export class ImageStudioControllerNoHostError extends Error {
  constructor() {
    super('Image Studio host did not attach before the open request timed out');
    this.name = 'ImageStudioControllerNoHostError';
  }
}

/** Options used to tune controller lifecycle behavior. */
export interface ImageStudioControllerOptions {
  /** Milliseconds to wait for a host subscription before rejecting an open request. */
  readonly noHostTimeoutMs?: number;
}

/** Framework-independent controller contract. */
export interface ImageStudioController {
  /** Opens Studio for one source and resolves when the host saves or cancels. */
  open(input: ImageStudioOpenInput): Promise<ImageStudioResult | null>;
  /** Closes the active Studio request and settles the pending `open` promise. */
  close(result?: ImageStudioResult | null): void;
  /** Returns whether a source is currently open. */
  isOpen(): boolean;
  /** Subscribes to controller snapshot changes for external-store adapters. */
  subscribe(listener: () => void): () => void;
  /** Returns the latest immutable controller snapshot. */
  getSnapshot(): ImageStudioControllerSnapshot;
}

interface PendingOpen {
  readonly resolve: (result: ImageStudioResult | null) => void;
  readonly reject: (error: Error) => void;
  noHostTimer: ReturnType<typeof setTimeout> | null;
  hostAttached: boolean;
}

const DEFAULT_NO_HOST_TIMEOUT_MS = 30_000;

/** Creates a promise-settling Image Studio controller. */
export function createImageStudioController(
  options: ImageStudioControllerOptions = {}
): ImageStudioController {
  const noHostTimeoutMs = options.noHostTimeoutMs ?? DEFAULT_NO_HOST_TIMEOUT_MS;
  let snapshot: ImageStudioControllerSnapshot = { open: false, input: null };
  let pending: PendingOpen | null = null;
  const listeners = new Set<() => void>();

  const publish = (): void => {
    for (const listener of listeners) listener();
  };

  const clearNoHostTimer = (): void => {
    if (!pending?.noHostTimer) return;
    clearTimeout(pending.noHostTimer);
    pending.noHostTimer = null;
  };

  const settleOpen = (result: ImageStudioResult | null): void => {
    if (!pending) return;
    const active = pending;
    pending = null;
    if (active.noHostTimer) clearTimeout(active.noHostTimer);
    snapshot = { open: false, input: null };
    publish();
    active.resolve(result);
  };

  const rejectOpen = (error: Error): void => {
    if (!pending) return;
    const active = pending;
    pending = null;
    if (active.noHostTimer) clearTimeout(active.noHostTimer);
    snapshot = { open: false, input: null };
    publish();
    active.reject(error);
  };

  return {
    open(input) {
      if (pending) return Promise.reject(new ImageStudioControllerBusyError());
      snapshot = { open: true, input };
      publish();
      return new Promise((resolve, reject) => {
        pending = {
          resolve,
          reject,
          noHostTimer: null,
          hostAttached: listeners.size > 0
        };
        // A missing host would otherwise leave callers with a permanently
        // pending promise. Once any host subscribes, ownership moves to that
        // host and unmount/cancel/save paths settle the request.
        if (!pending.hostAttached) {
          pending.noHostTimer = setTimeout(() => {
            rejectOpen(new ImageStudioControllerNoHostError());
          }, noHostTimeoutMs);
        }
      });
    },
    close(result = null) {
      settleOpen(result);
    },
    isOpen() {
      return snapshot.open;
    },
    subscribe(listener) {
      listeners.add(listener);
      if (pending) {
        pending.hostAttached = true;
        clearNoHostTimer();
      }
      return () => {
        const deleted = listeners.delete(listener);
        if (deleted && pending?.hostAttached && listeners.size === 0) {
          settleOpen(null);
        }
      };
    },
    getSnapshot() {
      return snapshot;
    }
  };
}

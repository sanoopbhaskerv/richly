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

/** Creates a promise-settling Image Studio controller. */
export function createImageStudioController(): ImageStudioController {
  let snapshot: ImageStudioControllerSnapshot = { open: false, input: null };
  let settle: ((result: ImageStudioResult | null) => void) | null = null;
  const listeners = new Set<() => void>();

  const publish = (): void => {
    for (const listener of listeners) listener();
  };

  return {
    open(input) {
      if (settle) return Promise.reject(new ImageStudioControllerBusyError());
      snapshot = { open: true, input };
      publish();
      return new Promise((resolve) => {
        // `settle` owns the single pending promise; clearing it first prevents
        // duplicate close calls from resolving stale host callbacks.
        settle = (result) => {
          if (!settle) return;
          settle = null;
          snapshot = { open: false, input: null };
          publish();
          resolve(result);
        };
      });
    },
    close(result = null) {
      settle?.(result);
    },
    isOpen() {
      return snapshot.open;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot() {
      return snapshot;
    }
  };
}

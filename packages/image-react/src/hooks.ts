import { useMemo, useRef, useSyncExternalStore } from 'react';
import type { ExportOptions, ImageSessionState, Size } from '@richly/image-core';
import { useImageEditor } from './context';
import { isFullCrop } from './cropGeometry';
import type { ImageCommandHelpers, ImageEditorUiState, ViewportState } from './types';

function identity<T>(value: T): T {
  return value;
}

/** Subscribes to immutable core session state with selector semantics. */
export function useImageEditorState<T>(
  selector: (state: ImageSessionState) => T,
  isEqual: (a: T, b: T) => boolean = Object.is
): T {
  const { session } = useImageEditor();
  if (!session) throw new Error('Image session is not ready');
  const cache = useRef<{ revision: number; selected: T } | null>(null);
  const getSelectedSnapshot = (): T => {
    const state = session.getState();
    const selected = selector(state);
    const previous = cache.current;
    if (previous && previous.revision === state.revision) return previous.selected;
    if (previous && isEqual(previous.selected, selected)) return previous.selected;
    cache.current = { revision: state.revision, selected };
    return selected;
  };
  return useSyncExternalStore(
    (listener) => session.subscribe(listener),
    getSelectedSnapshot,
    getSelectedSnapshot
  );
}

/** Subscribes to React-local UI state. */
export function useImageEditorUiState<T = ImageEditorUiState>(
  selector: (state: ImageEditorUiState) => T = identity as (state: ImageEditorUiState) => T
): T {
  const { uiStore } = useImageEditor();
  return useSyncExternalStore(
    uiStore.subscribe,
    () => selector(uiStore.getSnapshot()),
    () => selector(uiStore.getSnapshot())
  );
}

/** Returns stable command helpers that write only through image-core commands. */
export function useImageCommands(): ImageCommandHelpers {
  const { session } = useImageEditor();
  if (!session) throw new Error('Image session is not ready');
  return useMemo(
    () => ({
      crop: (rect) => void session.execute('crop', { rect }),
      resize: (width, height) => void session.execute('resize', { width, height }),
      rotate: (angle) => void session.execute('rotate', { angle }),
      flip: (axis) => void session.execute('flip', { axis }),
      adjust: (channel, value) => void session.execute('adjust', { channel, value })
    }),
    [session]
  );
}

/** Exposes public history summaries and navigation helpers. */
export function useImageHistory() {
  const { session } = useImageEditor();
  const history = useImageEditorState((state) => state.history);
  return {
    ...history,
    undo: () => session?.undo() ?? false,
    redo: () => session?.redo() ?? false,
    jumpTo: (index: number) => session?.jumpToHistory(index) ?? false
  };
}

/** Manages crop draft state and preview/commit/cancel behavior. */
export function useCropTool() {
  const { session, uiStore } = useImageEditor();
  const crop = useImageEditorUiState((state) => state.crop);
  return {
    ...crop,
    setDraft(rect: NonNullable<typeof crop.rect>, bounds?: Size) {
      uiStore.setCropDraft({ rect, bounds: bounds ?? crop.bounds });
    },
    setAspectRatio(aspectRatio: number | null) {
      uiStore.setCropDraft({ aspectRatio });
    },
    apply() {
      const rect = crop.rect;
      const bounds = crop.bounds;
      uiStore.setCropDraft({ rect: null, bounds: null });
      if (!rect || !bounds || isFullCrop(rect, bounds)) return { ok: true } as const;
      return session?.execute('crop', { rect }) ?? ({ ok: true } as const);
    },
    cancel() {
      uiStore.setCropDraft({ rect: null, bounds: null });
    }
  };
}

/** Reads and mutates viewport-only pan/zoom state. */
export function useViewport() {
  const { uiStore } = useImageEditor();
  const viewport = useImageEditorUiState((state) => state.viewport);
  return {
    ...viewport,
    setViewport: (next: Partial<ViewportState>) => uiStore.setViewport(next),
    zoomIn: () => uiStore.setViewport({ zoom: Math.min(8, viewport.zoom * 1.2), fit: false }),
    zoomOut: () => uiStore.setViewport({ zoom: Math.max(0.1, viewport.zoom / 1.2), fit: false }),
    fit: () => uiStore.setViewport({ zoom: 1, panX: 0, panY: 0, fit: true })
  };
}

/** Runs export with accessible busy/error state in the UI store. */
export function useImageExport() {
  const { session, uiStore } = useImageEditor();
  const exportStatus = useImageEditorUiState((state) => state.exportStatus);
  return {
    ...exportStatus,
    async exportImage(options?: ExportOptions) {
      if (!session) throw new Error('Image session is not ready');
      uiStore.setExportStatus({ busy: true, error: null });
      try {
        return await session.export(options);
      } catch (error) {
        uiStore.setExportStatus({ error: error instanceof Error ? error.message : String(error) });
        throw error;
      } finally {
        uiStore.setExportStatus({ busy: false });
      }
    }
  };
}

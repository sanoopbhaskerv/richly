import type { CropDraftState, ImageEditorUiState, ImageTool, ViewportState } from './types';

/** Small immutable UI store used by React primitives. */
export interface ImageEditorUiStore {
  getSnapshot(): ImageEditorUiState;
  subscribe(listener: () => void): () => void;
  setActiveTool(tool: ImageTool): void;
  setViewport(viewport: Partial<ViewportState>): void;
  setCropDraft(crop: Partial<CropDraftState>): void;
  setCompareMode(compareMode: boolean): void;
  setExportStatus(status: Partial<ImageEditorUiState['exportStatus']>): void;
  setInteractionError(error: string | null): void;
}

const initialState: ImageEditorUiState = {
  activeTool: 'adjust',
  viewport: { zoom: 1, panX: 0, panY: 0, fit: true },
  crop: { rect: null, bounds: null, aspectRatio: null },
  compareMode: false,
  exportStatus: { busy: false, error: null },
  interactionError: null
};

/** Creates a selector-friendly store without adding Redux/Zustand weight. */
export function createImageEditorUiStore(
  initial: Partial<ImageEditorUiState> = {}
): ImageEditorUiStore {
  let state: ImageEditorUiState = { ...initialState, ...initial };
  const listeners = new Set<() => void>();

  const publish = (next: ImageEditorUiState): void => {
    state = next;
    for (const listener of listeners) listener();
  };

  return {
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setActiveTool(tool) {
      publish({ ...state, activeTool: tool });
    },
    setViewport(viewport) {
      publish({ ...state, viewport: { ...state.viewport, ...viewport } });
    },
    setCropDraft(crop) {
      publish({ ...state, crop: { ...state.crop, ...crop } });
    },
    setCompareMode(compareMode) {
      publish({ ...state, compareMode });
    },
    setExportStatus(status) {
      publish({ ...state, exportStatus: { ...state.exportStatus, ...status } });
    },
    setInteractionError(error) {
      publish({ ...state, interactionError: error });
    }
  };
}

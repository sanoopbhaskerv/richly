import { CropOverlay, ImageCanvas, useImageEditorUiState } from '@richly/image-react';

/** Central canvas-first workspace. */
export function StudioWorkspace() {
  const activeTool = useImageEditorUiState((state) => state.activeTool);
  return (
    <main className="ris-workspace">
      <div className="ris-canvas-wrap">
        <ImageCanvas className="ris-canvas" aria-label="Image preview canvas" />
        {activeTool === 'crop' ? <CropOverlay /> : null}
      </div>
    </main>
  );
}

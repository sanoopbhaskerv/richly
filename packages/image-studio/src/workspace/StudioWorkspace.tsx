import { CropOverlay, ImageCanvas, useImageEditorUiState } from '@richly/image-react';
import { Filmstrip } from '../shell/Filmstrip';

/** Central canvas-first workspace. */
export function StudioWorkspace() {
  const activeTool = useImageEditorUiState((state) => state.activeTool);
  return (
    <main className="ris-workspace">
      <div className="ris-canvas-wrap">
        <ImageCanvas
          className="ris-canvas"
          aria-label="Image preview canvas"
          data-testid="image-canvas"
        />
        {activeTool === 'crop' ? <CropOverlay /> : null}
      </div>
      <Filmstrip />
    </main>
  );
}

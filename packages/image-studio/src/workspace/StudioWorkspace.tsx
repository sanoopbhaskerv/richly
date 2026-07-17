import { CropOverlay, ImageCanvas, useImageEditorUiState } from '@richly/image-react';
import { Filmstrip } from '../shell/Filmstrip';

/** Props for the central canvas-first workspace. */
export interface StudioWorkspaceProps {
  /** Optional host callback for the filmstrip Add image button. */
  readonly onAddImage?: () => void;
}

/** Central canvas-first workspace. */
export function StudioWorkspace(props: StudioWorkspaceProps) {
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
      <Filmstrip onAddImage={props.onAddImage} />
    </main>
  );
}

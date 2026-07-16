import { useEffect, useRef, type CanvasHTMLAttributes } from 'react';
import { useImageEditor } from './context';
import { useImageEditorState, useImageEditorUiState, useViewport } from './hooks';

/** Canvas host for image-core previews plus viewport gestures. */
export function ImageCanvas(props: CanvasHTMLAttributes<HTMLCanvasElement>) {
  const { session } = useImageEditor();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const revision = useImageEditorState((state) => state.revision);
  const compareMode = useImageEditorUiState((state) => state.compareMode);
  const viewport = useViewport();

  useEffect(() => {
    if (!session || !canvasRef.current) return;
    const handle = session.createPreview({ kind: 'canvas', canvas: canvasRef.current });
    // Preview rendering is async so stale work can be cancelled by disposing
    // the handle when the canvas/session/revision changes.
    void (compareMode ? handle.renderBefore() : handle.render());
    return () => handle.dispose();
  }, [compareMode, revision, session]);

  return (
    <canvas
      {...props}
      ref={canvasRef}
      onWheel={(event) => {
        props.onWheel?.(event);
        if (event.defaultPrevented) return;
        event.preventDefault();
        if (event.deltaY < 0) viewport.zoomIn();
        else viewport.zoomOut();
      }}
    />
  );
}

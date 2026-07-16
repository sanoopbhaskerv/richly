import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { useCropTool, useImageEditorState } from './hooks';
import { CropFrame, CropMasks, useCanvasLayerStyle } from './CropOverlayParts';
import {
  createCenteredCrop,
  moveCrop,
  pointerDeltaToImageDelta,
  resizeCrop,
  type CropHandle,
  type CropRect
} from './cropGeometry';

interface DragState {
  readonly handle: CropHandle;
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  readonly startRect: CropRect;
  readonly boundsRect: DOMRect;
}

/** Direct-manipulation crop frame with mask, thirds grid, handles, and keyboard movement. */
export function CropOverlay() {
  const crop = useCropTool();
  const sessionSize = useImageEditorState((state) => ({
    width: state.outputWidth,
    height: state.outputHeight
  }));
  const bounds = crop.bounds ?? sessionSize;
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const rect = crop.rect ?? createCenteredCrop(bounds, crop.aspectRatio);
  const layerStyle = useCanvasLayerStyle(overlayRef, bounds);

  useEffect(() => {
    if (!crop.rect) crop.setDraft(rect, bounds);
  }, [bounds, crop, crop.rect, rect]);

  const setRect = (next: typeof rect): void => {
    crop.setDraft(next);
  };

  const move = (dx: number, dy: number): void => {
    setRect(moveCrop(rect, bounds, dx, dy));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const step = event.shiftKey ? 10 : 1;
    if (event.key === 'Escape') {
      event.preventDefault();
      crop.cancel();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      crop.apply();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      move(-step, 0);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      move(step, 0);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      move(0, -step);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      move(0, step);
    }
  };

  const startDrag = (event: PointerEvent<HTMLElement>, handle: CropHandle): void => {
    if (!overlayRef.current) return;
    event.preventDefault();
    // Handle drags bubble through the frame; keep resize gestures from being
    // overwritten by the frame-level move gesture.
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      handle,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startRect: rect,
      boundsRect: overlayRef.current.getBoundingClientRect()
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const delta = pointerDeltaToImageDelta(
      event.clientX - drag.startX,
      event.clientY - drag.startY,
      drag.boundsRect,
      bounds
    );
    setRect(
      resizeCrop(drag.startRect, bounds, drag.handle, delta.deltaX, delta.deltaY, crop.aspectRatio)
    );
  };

  const stopDrag = (event: PointerEvent<HTMLDivElement>): void => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  const style = {
    insetInlineStart: `${(rect.x / bounds.width) * 100}%`,
    insetBlockStart: `${(rect.y / bounds.height) * 100}%`,
    inlineSize: `${(rect.width / bounds.width) * 100}%`,
    blockSize: `${(rect.height / bounds.height) * 100}%`
  };

  return (
    <div
      className="ris-crop-layer"
      style={layerStyle}
      ref={overlayRef}
      aria-label="Crop selection"
      role="group"
      tabIndex={0}
      data-testid="image-crop-overlay"
      onKeyDown={onKeyDown}
      onPointerMove={onPointerMove}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
    >
      <CropMasks style={style} />
      <CropFrame rect={rect} style={style} onApply={crop.apply} onDragStart={startDrag} />
    </div>
  );
}

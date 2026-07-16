import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { useCropTool, useImageEditorState } from './hooks';
import {
  createCenteredCrop,
  moveCrop,
  pointerDeltaToImageDelta,
  resizeCrop,
  type CropHandle,
  type CropRect
} from './cropGeometry';

const handles: Array<{ handle: CropHandle; label: string }> = [
  { handle: 'nw', label: 'Resize crop from top left' },
  { handle: 'n', label: 'Resize crop from top edge' },
  { handle: 'ne', label: 'Resize crop from top right' },
  { handle: 'e', label: 'Resize crop from right edge' },
  { handle: 'se', label: 'Resize crop from bottom right' },
  { handle: 's', label: 'Resize crop from bottom edge' },
  { handle: 'sw', label: 'Resize crop from bottom left' },
  { handle: 'w', label: 'Resize crop from left edge' }
];

interface DragState {
  readonly handle: CropHandle;
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  readonly startRect: CropRect;
  readonly boundsRect: DOMRect;
}

type CropFrameStyle = {
  readonly insetInlineStart: string;
  readonly insetBlockStart: string;
  readonly inlineSize: string;
  readonly blockSize: string;
};

interface CropMasksProps {
  readonly style: CropFrameStyle;
}

interface CropFrameProps {
  readonly rect: CropRect;
  readonly style: CropFrameStyle;
  readonly onApply: () => void;
  readonly onDragStart: (event: PointerEvent<HTMLElement>, handle: CropHandle) => void;
}

function CropMasks(props: CropMasksProps) {
  const { style } = props;
  return (
    <>
      <div
        className="ris-crop-mask ris-crop-mask-top"
        style={{ blockSize: style.insetBlockStart }}
      />
      <div
        className="ris-crop-mask ris-crop-mask-left"
        style={{
          insetBlockStart: style.insetBlockStart,
          blockSize: style.blockSize,
          inlineSize: style.insetInlineStart
        }}
      />
      <div
        className="ris-crop-mask ris-crop-mask-right"
        style={{
          insetBlockStart: style.insetBlockStart,
          insetInlineStart: `calc(${style.insetInlineStart} + ${style.inlineSize})`,
          blockSize: style.blockSize
        }}
      />
      <div
        className="ris-crop-mask ris-crop-mask-bottom"
        style={{
          insetBlockStart: `calc(${style.insetBlockStart} + ${style.blockSize})`
        }}
      />
    </>
  );
}

function CropFrame(props: CropFrameProps) {
  return (
    <div
      className="ris-crop-frame"
      style={props.style}
      onPointerDown={(event) => props.onDragStart(event, 'move')}
    >
      <div className="ris-crop-floating-toolbar" onPointerDown={(event) => event.stopPropagation()}>
        <span>{Math.round(props.rect.width)}</span>
        <span aria-hidden="true">x</span>
        <span>{Math.round(props.rect.height)}</span>
        <button type="button" onClick={props.onApply} aria-label="Apply crop">
          Apply
        </button>
      </div>
      <div className="ris-crop-grid" aria-hidden="true" />
      {handles.map((item) => (
        <button
          type="button"
          key={item.handle}
          className={`ris-crop-handle ris-crop-handle-${item.handle}`}
          aria-label={item.label}
          data-testid={`image-crop-handle-${item.handle}`}
          onPointerDown={(event) => props.onDragStart(event, item.handle)}
        />
      ))}
    </div>
  );
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

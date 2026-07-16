import {
  useLayoutEffect,
  useState,
  type CSSProperties,
  type PointerEvent,
  type RefObject
} from 'react';
import type { CropHandle, CropRect } from './cropGeometry';

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

/** CSS logical geometry for the visible crop frame within the measured canvas layer. */
export type CropFrameStyle = {
  readonly insetInlineStart: string;
  readonly insetBlockStart: string;
  readonly inlineSize: string;
  readonly blockSize: string;
};

type CropLayerStyle = CSSProperties & {
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

/** Non-interactive shaded crop masks surrounding the selected rectangle. */
export function CropMasks(props: CropMasksProps) {
  const { style } = props;
  return (
    <>
      <div
        className="ris-crop-mask ris-crop-mask-top"
        data-testid="image-crop-mask"
        style={{ blockSize: style.insetBlockStart }}
      />
      <div
        className="ris-crop-mask ris-crop-mask-left"
        data-testid="image-crop-mask"
        style={{
          insetBlockStart: style.insetBlockStart,
          blockSize: style.blockSize,
          inlineSize: style.insetInlineStart
        }}
      />
      <div
        className="ris-crop-mask ris-crop-mask-right"
        data-testid="image-crop-mask"
        style={{
          insetBlockStart: style.insetBlockStart,
          insetInlineStart: `calc(${style.insetInlineStart} + ${style.inlineSize})`,
          blockSize: style.blockSize
        }}
      />
      <div
        className="ris-crop-mask ris-crop-mask-bottom"
        data-testid="image-crop-mask"
        style={{
          insetBlockStart: `calc(${style.insetBlockStart} + ${style.blockSize})`
        }}
      />
    </>
  );
}

/** Interactive crop rectangle, dimension toolbar, and resize handles. */
export function CropFrame(props: CropFrameProps) {
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
      <div className="ris-crop-grid" aria-hidden="true" data-testid="image-crop-grid" />
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

/** Measures the rendered canvas so the overlay tracks CSS-constrained image bounds. */
export function useCanvasLayerStyle(
  overlayRef: RefObject<HTMLDivElement>,
  bounds: { readonly width: number; readonly height: number }
): CropLayerStyle | undefined {
  const [style, setStyle] = useState<CropLayerStyle>();

  useLayoutEffect(() => {
    const layer = overlayRef.current;
    const parent = layer?.parentElement;
    const canvas = parent?.querySelector('canvas');
    if (!layer || !parent || !canvas) return undefined;

    const update = (): void => {
      const parentRect = parent.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      setStyle({
        inset: 'auto',
        insetInlineStart: `${canvasRect.left - parentRect.left}px`,
        insetBlockStart: `${canvasRect.top - parentRect.top}px`,
        inlineSize: `${canvasRect.width}px`,
        blockSize: `${canvasRect.height}px`
      });
    };

    // CSS max-size constraints can make the rendered canvas smaller than its
    // wrapper. The crop layer must track the rendered canvas, not the wrapper.
    update();
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => update());
    observer?.observe(parent);
    observer?.observe(canvas);
    window.addEventListener('resize', update);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [bounds.height, bounds.width, overlayRef]);

  return style;
}

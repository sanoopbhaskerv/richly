import type { KeyboardEvent, PointerEvent } from 'react';
import { useCropTool } from './hooks';

/** Keyboard and pointer accessible crop overlay primitive. */
export function CropOverlay() {
  const crop = useCropTool();
  const rect = crop.rect;

  const move = (dx: number, dy: number): void => {
    if (!rect) return;
    crop.setDraft({ ...rect, x: Math.max(0, rect.x + dx), y: Math.max(0, rect.y + dy) });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const step = event.shiftKey ? 10 : 1;
    if (event.key === 'Escape') {
      event.preventDefault();
      crop.cancel();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      crop.apply();
    } else if (event.key === 'ArrowLeft') move(-step, 0);
    else if (event.key === 'ArrowRight') move(step, 0);
    else if (event.key === 'ArrowUp') move(0, -step);
    else if (event.key === 'ArrowDown') move(0, step);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  return (
    <div
      aria-label="Crop selection"
      role="slider"
      tabIndex={0}
      data-testid="image-crop-overlay"
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      style={{
        position: 'absolute',
        insetInlineStart: rect?.x ?? 0,
        insetBlockStart: rect?.y ?? 0,
        width: rect?.width ?? 0,
        height: rect?.height ?? 0
      }}
    />
  );
}

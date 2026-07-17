/**
 * Anchors the inline image toolbar to the selected image.
 *
 * The toolbar is absolutely positioned inside the editor root (the same
 * strategy as the core text inline toolbar), preferring the space above the
 * image, flipping below it when the viewport or editor chrome is in the way,
 * and clamping horizontally to the root. The bubble pointer tracks the image
 * center through a CSS custom property so it stays truthful after clamping.
 */

import type { Editor } from '@richly/core';

export interface ToolbarPositioner {
  /** Repositions the toolbar (or applies the compact layout) immediately. */
  reposition(): void;
  /** Starts observing an anchor image for load/resize-driven movement. */
  observe(image: HTMLImageElement | null): void;
  /** True when the editor container is narrower than the compact breakpoint. */
  isCompact(): boolean;
  /** Removes listeners and observers. */
  destroy(): void;
}

export function createToolbarPositioner(
  editor: Editor,
  bar: HTMLElement,
  getAnchor: () => HTMLImageElement | null,
  compactBreakpoint: number
): ToolbarPositioner {
  const root = editor.getRoot();
  const body = editor.getBody();
  const doc = body.ownerDocument;
  const view = doc.defaultView;
  let observed: HTMLImageElement | null = null;

  const compact = (): boolean => root.getBoundingClientRect().width < compactBreakpoint;

  const reposition = (): void => {
    const image = getAnchor();
    if (!image || !bar.classList.contains('rly-open')) return;

    if (compact()) {
      bar.classList.add('rly-compact');
      bar.classList.remove('rly-flip');
      bar.style.left = '';
      bar.style.top = '';
      return;
    }
    bar.classList.remove('rly-compact');

    const rootRect = root.getBoundingClientRect();
    const bodyRect = body.getBoundingClientRect();
    const rect = image.getBoundingClientRect();
    const barRect = bar.getBoundingClientRect();

    const left = Math.max(
      8,
      Math.min(
        rootRect.width - barRect.width - 8,
        rect.left - rootRect.left + rect.width / 2 - barRect.width / 2
      )
    );

    const gap = 12;
    const minTopInsideContent = bodyRect.top - rootRect.top + 8;
    const preferredAboveTop = rect.top - rootRect.top - barRect.height - gap;
    const fitsAbove =
      (!view || rect.top - gap - barRect.height - 8 >= 0) &&
      preferredAboveTop >= minTopInsideContent;
    bar.classList.toggle('rly-flip', !fitsAbove);
    const rawTop = fitsAbove ? preferredAboveTop : rect.bottom - rootRect.top + gap;
    const top = Math.max(minTopInsideContent, rawTop);

    // Keep the pointer aimed at the image center even when clamping shifted
    // the bubble; the pointer itself stays within the bubble's rounded area.
    const pointer = Math.max(
      16,
      Math.min(barRect.width - 16, rect.left - rootRect.left + rect.width / 2 - left)
    );
    bar.style.setProperty('--rly-image-toolbar-pointer', `${pointer}px`);
    bar.style.left = `${left}px`;
    bar.style.top = `${top}px`;
  };

  const resizeObserver =
    typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => reposition());
  resizeObserver?.observe(root);

  const onScroll = (): void => reposition();
  body.addEventListener('scroll', onScroll);
  view?.addEventListener('resize', onScroll);

  const onImageLoad = (): void => reposition();

  return {
    reposition,
    observe(image) {
      if (observed && observed !== image) {
        if (resizeObserver) resizeObserver.unobserve(observed);
        observed.removeEventListener('load', onImageLoad);
      }
      if (image && observed !== image) {
        resizeObserver?.observe(image);
        image.addEventListener('load', onImageLoad);
      }
      observed = image;
    },
    isCompact: compact,
    destroy() {
      resizeObserver?.disconnect();
      body.removeEventListener('scroll', onScroll);
      view?.removeEventListener('resize', onScroll);
      observed?.removeEventListener('load', onImageLoad);
      observed = null;
    }
  };
}

/**
 * Positions a popover under (or above) its anchor button, clamped to the
 * editor root. Compact layouts pin it as a bottom sheet instead.
 */
export function positionPopover(
  root: HTMLElement,
  popover: HTMLElement,
  anchor: HTMLElement,
  compactSheet: boolean
): void {
  popover.classList.toggle('rly-sheet', compactSheet);
  if (compactSheet) {
    popover.style.left = '';
    popover.style.top = '';
    return;
  }
  const rootRect = root.getBoundingClientRect();
  const anchorRect = anchor.getBoundingClientRect();
  const popRect = popover.getBoundingClientRect();
  const left = Math.max(
    8,
    Math.min(
      rootRect.width - popRect.width - 8,
      anchorRect.left - rootRect.left + anchorRect.width / 2 - popRect.width / 2
    )
  );
  const below = anchorRect.bottom - rootRect.top + 8;
  const above = anchorRect.top - rootRect.top - popRect.height - 8;
  const top = below + popRect.height <= rootRect.height - 8 ? below : Math.max(8, above);
  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
}

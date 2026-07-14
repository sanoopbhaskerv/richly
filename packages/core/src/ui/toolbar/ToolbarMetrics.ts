/** Return every element whose resolved width can constrain the toolbar. */
export function toolbarWidthBoundaries(container: HTMLElement): HTMLElement[] {
  const boundaries: HTMLElement[] = [];
  let boundary: HTMLElement | null = container;
  while (boundary) {
    boundaries.push(boundary);
    boundary = boundary.parentElement;
  }
  return boundaries;
}

/**
 * Measure usable inline space using the narrowest consumer boundary.
 *
 * A toolbar inside a min-content flex or grid track can report an intrinsic
 * width larger than its host. Measuring the entire ancestor chain keeps both
 * overflow strategies aligned with the space users can actually see.
 */
export function availableToolbarWidth(container: HTMLElement): number {
  const view = container.ownerDocument.defaultView;
  const styles = view?.getComputedStyle(container);
  const leftPadding = Number.parseFloat(styles?.paddingLeft ?? '0');
  const rightPadding = Number.parseFloat(styles?.paddingRight ?? '0');
  const padding =
    (Number.isFinite(leftPadding) ? leftPadding : 0) +
    (Number.isFinite(rightPadding) ? rightPadding : 0);

  const boundaryWidths = toolbarWidthBoundaries(container).map((boundary) => {
    const boundaryStyles = view?.getComputedStyle(boundary);
    const borderLeft = Number.parseFloat(boundaryStyles?.borderLeftWidth ?? '0');
    const borderRight = Number.parseFloat(boundaryStyles?.borderRightWidth ?? '0');
    const borderWidth =
      (Number.isFinite(borderLeft) ? borderLeft : 0) +
      (Number.isFinite(borderRight) ? borderRight : 0);
    const rectWidth = boundary.getBoundingClientRect().width;
    // DOMRect retains fractional grid/flex track sizes whereas clientWidth
    // rounds to an integer. Fall back for jsdom and unmeasured boxes.
    return rectWidth > 0 ? Math.max(0, rectWidth - borderWidth) : boundary.clientWidth;
  });

  if (boundaryWidths.length === 0 || boundaryWidths.some((width) => width <= 0)) return 0;
  return Math.min(...boundaryWidths) - padding;
}

/** Measure the total outer width of visible toolbar children. */
export function occupiedToolbarWidth(container: HTMLElement, parent: HTMLElement): number {
  const view = container.ownerDocument.defaultView;
  const styles = view?.getComputedStyle(parent);
  const parsedGap = Number.parseFloat(styles?.columnGap ?? styles?.gap ?? '0');
  const gap = Number.isFinite(parsedGap) ? parsedGap : 0;
  const children = Array.from(parent.children).filter(
    (child): child is HTMLElement => !(child as HTMLElement).hidden
  );
  const outerWidth = (child: HTMLElement): number => {
    const childStyles = view?.getComputedStyle(child);
    const marginLeft = Number.parseFloat(childStyles?.marginLeft ?? '0');
    const marginRight = Number.parseFloat(childStyles?.marginRight ?? '0');
    // These controls use margin-left:auto only for end alignment. Chromium
    // exposes the resolved free space as a pixel margin, which must not count
    // as required content width during redistribution.
    const hasAutoStartMargin =
      child.classList.contains('rly-toolbar-overflow') ||
      child.classList.contains('rly-toolbar-sliding-toggle');
    return (
      child.getBoundingClientRect().width +
      (!hasAutoStartMargin && Number.isFinite(marginLeft) ? marginLeft : 0) +
      (Number.isFinite(marginRight) ? marginRight : 0)
    );
  };
  return (
    children.reduce((width, child) => width + outerWidth(child), 0) +
    Math.max(0, children.length - 1) * gap
  );
}

import type { AdjustQuickDraft } from './quickEdit';

interface ActivePopover {
  readonly element: HTMLElement;
}

/** Mirrors the active grayscale slider state onto its toolbar button. */
export function syncGrayscalePressed(
  bar: HTMLElement,
  draft: AdjustQuickDraft | null,
  popover: ActivePopover | null
): void {
  const grayscale = bar.querySelector<HTMLButtonElement>('[data-testid="image-toolbar-grayscale"]');
  grayscale?.setAttribute(
    'aria-pressed',
    String((draft?.value() ?? 0) > 0 && popover?.element.getAttribute('aria-label') === 'Grayscale')
  );
}

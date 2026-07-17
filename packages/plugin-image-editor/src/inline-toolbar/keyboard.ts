/**
 * Roving-tabindex keyboard navigation for the image toolbar, matching the
 * behavior of the core text inline toolbar (Left/Right, Home/End, Escape).
 */

export interface RovingNavigation {
  /** Moves focus to the first enabled button and arms roving tab stops. */
  focusFirst(): void;
  /** Clears every tab stop (used when the toolbar hides). */
  reset(): void;
  /** Detaches the keydown listener. */
  destroy(): void;
}

/**
 * @param container Toolbar element containing the buttons.
 * @param onEscape Called for Escape; the controller decides whether that
 *   closes a popover, returns to root, or dismisses the toolbar.
 */
export function installRovingNavigation(
  container: HTMLElement,
  onEscape: () => void
): RovingNavigation {
  const doc = container.ownerDocument;

  const buttons = (): HTMLButtonElement[] =>
    Array.from(container.querySelectorAll<HTMLButtonElement>('button:not([disabled])')).filter(
      (button) => button.offsetParent !== null || button.isConnected
    );

  const focusAt = (index: number): void => {
    const enabled = buttons();
    if (!enabled.length) return;
    const target = ((index % enabled.length) + enabled.length) % enabled.length;
    enabled.forEach((button, buttonIndex) => (button.tabIndex = buttonIndex === target ? 0 : -1));
    enabled[target]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    const enabled = buttons();
    const current = enabled.indexOf(doc.activeElement as HTMLButtonElement);
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      focusAt(current + (event.key === 'ArrowRight' ? 1 : -1));
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      focusAt(event.key === 'Home' ? 0 : enabled.length - 1);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onEscape();
    }
  };

  container.addEventListener('keydown', onKeyDown);

  return {
    focusFirst: () => focusAt(0),
    reset() {
      for (const button of buttons()) button.tabIndex = -1;
    },
    destroy() {
      container.removeEventListener('keydown', onKeyDown);
    }
  };
}

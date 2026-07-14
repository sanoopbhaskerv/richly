/**
 * Install the ARIA toolbar roving-tabindex pattern.
 *
 * Available controls are derived from live DOM order because responsive modes
 * can move complete groups after initialization. Closed overflow containers
 * are excluded without rebuilding the original focusable-control registry.
 */
export function installToolbarKeyboardNavigation(
  container: HTMLElement,
  focusables: HTMLElement[]
): () => void {
  focusables.forEach((control, index) => (control.tabIndex = index === 0 ? 0 : -1));
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const doc = container.ownerDocument;
    const activeElement = doc.activeElement;
    if (activeElement?.nodeName === 'SELECT') return;
    const available = focusables.filter((control) => {
      if (control.hidden || control.closest('[hidden]')) return false;
      const overflow = control.closest('.rly-toolbar-overflow-panel');
      if (overflow && !overflow.classList.contains('rly-open')) return false;
      const drawer = control.closest('.rly-toolbar-sliding-drawer');
      return !drawer || drawer.classList.contains('rly-open');
    });
    available.sort((left, right) => {
      if (left === right) return 0;
      return left.compareDocumentPosition(right) & 4 ? -1 : 1;
    });
    const index = available.findIndex((control) => control === doc.activeElement);
    if (index === -1 || available.length === 0) return;
    event.preventDefault();
    const next =
      event.key === 'ArrowRight'
        ? (index + 1) % available.length
        : (index - 1 + available.length) % available.length;
    focusables.forEach((control) => (control.tabIndex = -1));
    available[next]!.tabIndex = 0;
    available[next]!.focus();
  };
  container.addEventListener('keydown', onKeyDown);
  return () => container.removeEventListener('keydown', onKeyDown);
}

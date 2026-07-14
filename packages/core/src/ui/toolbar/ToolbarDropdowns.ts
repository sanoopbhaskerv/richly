/** Remove inline placement left by a previously positioned toolbar panel. */
export function resetToolbarDropdownPosition(dropdown: HTMLElement): void {
  dropdown.style.left = '';
  dropdown.style.right = '';
  dropdown.style.top = '';
  dropdown.style.bottom = '';
  dropdown.style.marginTop = '';
  dropdown.style.marginBottom = '';
}

function closeDropdown(dropdown: HTMLElement): void {
  dropdown.classList.remove('rly-open');
  dropdown.parentElement?.querySelector(':scope > button')?.setAttribute('aria-expanded', 'false');
}

/** Close every open dropdown below a toolbar root and synchronize its trigger. */
export function closeToolbarDropdowns(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('.rly-tb-dd.rly-open').forEach((dropdown) => {
    closeDropdown(dropdown);
  });
}

/** Close document-level panels and clear placement left by their former trigger. */
export function closePositionedToolbarDropdowns(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('.rly-tb-dd.rly-open').forEach((dropdown) => {
    resetToolbarDropdownPosition(dropdown);
    closeDropdown(dropdown);
  });
}

/**
 * Ask open panels to recalculate their viewport placement after their toolbar
 * group moves between responsive containers.
 */
export function repositionToolbarDropdowns(root: ParentNode, doc: Document): void {
  const EventConstructor = doc.defaultView?.Event;
  if (!EventConstructor) return;
  root.querySelectorAll<HTMLElement>('.rly-tb-dd.rly-open').forEach((dropdown) => {
    dropdown.dispatchEvent(new EventConstructor('rly-panel-resize'));
  });
}

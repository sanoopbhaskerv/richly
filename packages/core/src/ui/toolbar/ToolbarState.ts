import type { Editor } from '../../editor/Editor';
import type { ToolbarRenderModel } from './ToolbarModel';

/** Synchronize rendered controls with the editor's current command state. */
export function refreshToolbarState(
  editor: Editor,
  container: HTMLElement,
  model: ToolbarRenderModel
): void {
  for (const choice of model.choiceMenus) {
    const value = choice.valueCommand ? editor.queryCommandValue(choice.valueCommand) : '';
    const selected = choice.entries.find(({ item }) => item.value === value);
    for (const entry of choice.entries) {
      const active = entry === selected;
      entry.el.classList.toggle('rly-active', active);
      // Only radio-style value menus expose checked state. Action menus use
      // role="menuitem", where aria-checked would be invalid and misleading.
      if (choice.valueCommand) entry.el.setAttribute('aria-checked', String(active));
    }
    if (choice.label && selected) choice.label.textContent = selected.item.label;
  }

  for (const indicator of model.valueIndicators) {
    const value = editor.queryCommandValue(indicator.command);
    if (value) indicator.el.style.setProperty('--rly-control-value', value);
    else indicator.el.style.removeProperty('--rly-control-value');
  }

  for (const select of model.selects) {
    const value = editor.queryCommandValue(select.command);
    select.el.querySelector('.rly-temp-option')?.remove();
    const hasPreset = Array.from(select.el.options).some((option) => option.value === value);
    if (value && !hasPreset) {
      const option = container.ownerDocument.createElement('option');
      option.value = value;
      option.textContent = value;
      option.className = 'rly-temp-option';
      select.el.appendChild(option);
    }
    select.el.value = value;
  }

  for (const toggle of model.toggles) {
    const active = editor.queryCommandState(toggle.command);
    toggle.el.classList.toggle('rly-active', active);
    toggle.el.setAttribute('aria-pressed', String(active));
  }
}

import type { Editor } from '../../editor/Editor';
import { renderChoiceControl } from '../ChoiceControl';
import { formatShortcutLabel } from '../Shortcut';
import { icons } from '../icons';
import type { ToolbarRenderModel } from './ToolbarModel';
import { renderToolbarPanelControl } from './ToolbarPanelControl';

/**
 * Render a toolbar specification into atomic visual sections and state hooks.
 *
 * The renderer owns control creation only. It does not decide which sections
 * fit, where overflow belongs, or how editor state is refreshed. That boundary
 * lets new control types evolve without coupling them to responsive policy.
 */
export function renderToolbar(
  editor: Editor,
  container: HTMLElement,
  spec: string
): ToolbarRenderModel {
  const doc = container.ownerDocument;
  const model: ToolbarRenderModel = {
    toggles: [],
    selects: [],
    valueIndicators: [],
    choiceMenus: [],
    focusables: [],
    sections: []
  };
  // `|` separates atomic groups; `||` starts an intentional visual row in
  // wrap mode. Responsive modes ignore row breaks and move complete sections.
  const rows = spec
    .split(/\|\|/)
    .map((row) => row.split('|').map((group) => group.trim().split(/\s+/).filter(Boolean)));

  rows.forEach((groups, rowIndex) => {
    if (rowIndex > 0) {
      const rowBreak = doc.createElement('div');
      rowBreak.className = 'rly-tb-row-break';
      rowBreak.setAttribute('aria-hidden', 'true');
      container.appendChild(rowBreak);
    }
    groups.forEach((names, groupIndex) => {
      const section: HTMLElement[] = [];
      if (groupIndex > 0) {
        const separator = doc.createElement('div');
        separator.className = 'rly-tb-sep';
        container.appendChild(separator);
        section.push(separator);
      }
      const group = doc.createElement('div');
      group.className = 'rly-tb-group';

      for (const name of names) {
        const control = editor.ui.buttons.get(name);
        if (!control) continue;

        if (control.type === 'component') {
          group.appendChild(control.render(editor));
          continue;
        }

        if (control.type === 'select') {
          const select = doc.createElement('select');
          select.className = 'rly-tb-select';
          select.dataset.testid = `tb-select-${name}`;
          select.setAttribute('aria-label', control.tooltip);
          control.options.forEach((optionSpec) => {
            const option = doc.createElement('option');
            option.textContent = optionSpec.label;
            option.value = optionSpec.value;
            select.appendChild(option);
          });
          select.addEventListener('change', () =>
            editor.execCommand(control.command, select.value)
          );
          group.appendChild(select);
          model.selects.push({ name, el: select, command: control.command });
          model.focusables.push(select);
          continue;
        }

        if (control.type === 'menu' || control.type === 'split') {
          const rendered = renderChoiceControl(editor, container, name, control);
          group.appendChild(rendered.element);
          model.focusables.push(...rendered.focusables);
          model.choiceMenus.push(rendered.state);
          continue;
        }

        const button = doc.createElement('button');
        button.type = 'button';
        button.className = 'rly-tb-btn';
        button.dataset.testid = `tb-${name}`;
        button.setAttribute('aria-label', control.tooltip);
        // data-tooltip drives the CSS pseudo-element; omitting title prevents a
        // second browser-native tooltip from appearing over it.
        const tooltipText = control.shortcut
          ? `${control.tooltip} (${formatShortcutLabel(control.shortcut, doc)})`
          : control.tooltip;
        button.innerHTML = icons[control.icon] ?? control.icon;
        if (control.type === 'toggle') button.setAttribute('aria-pressed', 'false');
        // Keeping focus in the content preserves the active editor selection.
        button.addEventListener('mousedown', (event) => event.preventDefault());

        if (control.type === 'panel') {
          const rendered = renderToolbarPanelControl(
            editor,
            container,
            name,
            control,
            button,
            tooltipText
          );
          group.appendChild(rendered.element);
          if (rendered.valueIndicator) model.valueIndicators.push(rendered.valueIndicator);
        } else {
          button.dataset.tooltip = tooltipText;
          button.addEventListener('click', () => {
            editor.execCommand(
              control.command,
              control.type === 'button' ? control.args : undefined
            );
            // Commands that open a modal own focus until the dialog closes.
            if (!doc.querySelector('.rly-dialog-overlay')) editor.focus();
          });
          group.appendChild(button);
          if (control.type === 'toggle') {
            model.toggles.push({ name, el: button, command: control.command });
          }
        }
        model.focusables.push(button);
      }

      container.appendChild(group);
      section.push(group);
      model.sections.push(section);
    });
  });

  return model;
}

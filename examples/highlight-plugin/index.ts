import { applyInlineStyle, getInlineStyleValue, type Plugin } from '@richly/core';

const HIGHLIGHT_COLOR = '#fef08a';
const HIGHLIGHT_ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 11 4 4 8-8-4-4-8 8Z"/><path d="m9 11-6 6v4h4l6-6"/><path d="M3 21h13" stroke="#eab308" stroke-width="2.8"/></svg>';

/**
 * Example fixed-color highlighter built entirely on Richly's public plugin API.
 * `applyInlineStyle` clips structural selections to individual blocks, so the
 * command is safe across partial or multi-item list selections.
 */
export const highlightPlugin: Plugin = {
  name: 'highlight',
  init(editor) {
    editor.commands.register('Highlight', {
      execute(ed) {
        const active = getInlineStyleValue(ed, 'background-color');
        applyInlineStyle(ed, 'background-color', active ? '' : HIGHLIGHT_COLOR);
      },
      queryState: (ed) => !!getInlineStyleValue(ed, 'background-color'),
      queryValue: (ed) => getInlineStyleValue(ed, 'background-color')
    });

    editor.ui.addToggleButton('highlight', {
      icon: HIGHLIGHT_ICON,
      tooltip: 'Highlight selection (plugin)',
      command: 'Highlight'
    });
    editor.ui.addMenuItem('highlight', {
      menu: 'format',
      text: 'Highlight',
      command: 'Highlight'
    });
  }
};

import type { Plugin } from './types';
import type { Editor, LineHeightOption } from '../editor/Editor';
import { blocksInRange } from '../dom/DomUtils';
import { getEditorConfig } from '../editor/Editor';

const DEFAULT_LINE_HEIGHTS: LineHeightOption[] = [
  { label: 'Normal', value: '' },
  { label: '1.0', value: '1' },
  { label: '1.15', value: '1.15' },
  { label: '1.25', value: '1.25' },
  { label: '1.5', value: '1.5' },
  { label: '1.75', value: '1.75' },
  { label: '2.0', value: '2' },
  { label: '2.5', value: '2.5' },
  { label: '3.0', value: '3' }
];

/**
 * Normalize configured choices to finite unitless values. Unitless spacing is
 * intentional: it scales with the block's font size and serializes portably.
 */
function lineHeightOptions(editor: Editor): LineHeightOption[] {
  const configured = getEditorConfig(editor).textStyles?.lineHeights ?? DEFAULT_LINE_HEIGHTS;
  const unique = new Map<string, LineHeightOption>();
  for (const option of configured) {
    const value = option.value.trim();
    const numeric = Number(value);
    if (value !== '' && (!Number.isFinite(numeric) || numeric <= 0)) continue;
    unique.set(value, { label: option.label.trim() || value || 'Normal', value });
  }
  if (!unique.has('')) unique.set('', { label: 'Normal', value: '' });
  return [...unique.values()];
}

/** Return the common inline line height; use a sentinel so mixed is not shown as Normal. */
function selectedLineHeight(editor: Editor): string {
  const range = editor.selection.getRange();
  if (!range) return '';
  const values = blocksInRange(range, editor.getBody()).map((block) => block.style.lineHeight);
  return values.length && values.every((value) => value === values[0]) ? values[0]! : '__mixed__';
}

export const lineHeightPlugin: Plugin = {
  name: 'lineheight',
  init(editor) {
    const options = lineHeightOptions(editor);
    editor.commands.register('LineHeight', {
      execute: (ed, args) => {
        const requested = typeof args === 'string' ? args : (args as { value?: string })?.value;
        if (requested === undefined || !options.some(({ value }) => value === requested)) return;
        const range = ed.selection.getRange();
        if (!range) return;
        const bookmark = ed.selection.getBookmark();

        // Apply to each leaf block exactly once. This avoids wrapping inline
        // ranges and keeps list structure valid when LI elements are selected.
        for (const block of blocksInRange(range, ed.getBody())) {
          block.style.lineHeight = requested;
          if (!block.getAttribute('style')) block.removeAttribute('style');
        }
        ed.selection.moveToBookmark(bookmark);
        ed.events.emit('change', ed.getContent());
      },
      queryValue: (ed) => selectedLineHeight(ed)
    });
    editor.ui.addButton('lineheight', {
      type: 'menu',
      icon: 'lineheight',
      tooltip: 'Line height',
      valueCommand: 'LineHeight',
      showLabel: true,
      items: options.map((option) => ({
        value: option.value,
        label: option.label,
        command: 'LineHeight',
        args: option.value
      }))
    });
  }
};

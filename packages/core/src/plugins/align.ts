import type { Plugin } from './types';
import type { Editor } from '../editor/Editor';
import { blocksInRange } from '../dom/DomUtils';

const ALIGNS: { name: string; command: string; value: string; icon: string; tooltip: string }[] = [
  {
    name: 'alignleft',
    command: 'JustifyLeft',
    value: 'left',
    icon: 'alignleft',
    tooltip: 'Align left'
  },
  {
    name: 'aligncenter',
    command: 'JustifyCenter',
    value: 'center',
    icon: 'aligncenter',
    tooltip: 'Align center'
  },
  {
    name: 'alignright',
    command: 'JustifyRight',
    value: 'right',
    icon: 'alignright',
    tooltip: 'Align right'
  },
  {
    name: 'alignjustify',
    command: 'JustifyFull',
    value: 'justify',
    icon: 'alignjustify',
    tooltip: 'Justify'
  }
];

/** Return the shared alignment for the selection, or an empty string for mixed blocks. */
function selectedAlignment(editor: Editor): string {
  const range = editor.selection.getRange();
  if (!range) return '';
  const values = blocksInRange(range, editor.getBody()).map(
    (block) => block.style.textAlign || 'left'
  );
  return values.length && values.every((value) => value === values[0]) ? values[0]! : '';
}

export const alignPlugin: Plugin = {
  name: 'align',
  init(editor) {
    for (const a of ALIGNS) {
      editor.commands.register(a.command, {
        execute: (ed) => {
          const range = ed.selection.getRange();
          if (!range) return;
          const bookmark = ed.selection.getBookmark();
          for (const block of blocksInRange(range, ed.getBody())) {
            // "left" clears the style (it's the default) instead of littering the HTML.
            block.style.textAlign = a.value === 'left' ? '' : a.value;
            if (!block.getAttribute('style')) block.removeAttribute('style');
          }
          ed.selection.moveToBookmark(bookmark);
          ed.events.emit('change', ed.getContent());
        },
        queryState: (ed) => {
          const range = ed.selection.getRange();
          if (!range) return false;
          const blocks = blocksInRange(range, ed.getBody());
          if (!blocks.length) return false;
          return blocks.every((b) => (b.style.textAlign || 'left') === a.value);
        }
      });
      editor.ui.addToggleButton(a.name, { icon: a.icon, tooltip: a.tooltip, command: a.command });
    }

    // One menu exposes the full paragraph-alignment model while the legacy
    // individual buttons remain available to existing toolbar strings.
    editor.commands.register('Alignment', {
      execute: (ed, args) => {
        const value = typeof args === 'string' ? args : (args as { value?: string })?.value;
        const match = ALIGNS.find((alignment) => alignment.value === value);
        if (match) ed.execCommand(match.command);
      },
      queryValue: (ed) => selectedAlignment(ed)
    });
    editor.ui.addButton('alignment', {
      type: 'menu',
      icon: 'alignleft',
      tooltip: 'Alignment',
      valueCommand: 'Alignment',
      items: ALIGNS.map((alignment) => ({
        value: alignment.value,
        label: alignment.tooltip,
        icon: alignment.icon,
        command: alignment.command
      }))
    });
  }
};

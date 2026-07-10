import type { Plugin } from './types';
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
  }
};

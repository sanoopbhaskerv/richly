import type { Plugin } from './types';
import { transformBlock, closestBlock } from '../dom/DomUtils';

const BLOCK_BUTTONS: { name: string; tag: string; icon: string; tooltip: string }[] = [
  { name: 'h1', tag: 'h1', icon: 'h1', tooltip: 'Heading 1' },
  { name: 'h2', tag: 'h2', icon: 'h2', tooltip: 'Heading 2' },
  { name: 'paragraph', tag: 'p', icon: 'paragraph', tooltip: 'Paragraph' },
  { name: 'blockquote', tag: 'blockquote', icon: 'blockquote', tooltip: 'Quote' }
];

export const blocksPlugin: Plugin = {
  name: 'blocks',
  init(editor) {
    editor.commands.register('FormatBlock', {
      execute: (ed, args) => {
        const tag = typeof args === 'string' ? args : (args as { tag?: string })?.tag;
        if (!tag) return;
        const range = ed.selection.getRange();
        if (!range) return;
        const bookmark = ed.selection.getBookmark();
        transformBlock(range.startContainer, tag.toLowerCase(), ed.getBody());
        ed.selection.moveToBookmark(bookmark);
        ed.events.emit('change', ed.getContent());
      }
    });

    for (const b of BLOCK_BUTTONS) {
      // Each block button is a distinct toggle so the active one lights up.
      editor.commands.register(`FormatBlock:${b.tag}`, {
        execute: (ed) => ed.execCommand('FormatBlock', b.tag),
        queryState: (ed) => {
          const range = ed.selection.getRange();
          if (!range) return false;
          return closestBlock(range.startContainer, ed.getBody())?.tagName.toLowerCase() === b.tag;
        },
        skipUndo: true // inner FormatBlock takes the snapshot
      });
      editor.ui.addToggleButton(b.name, { icon: b.icon, tooltip: b.tooltip, command: `FormatBlock:${b.tag}` });
      editor.ui.addMenuItem(b.name, { menu: 'format', text: b.tooltip, command: `FormatBlock:${b.tag}` });
    }
  }
};

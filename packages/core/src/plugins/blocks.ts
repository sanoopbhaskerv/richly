import type { Plugin } from './types';
import { blocksInRange, transformBlock, closestBlock } from '../dom/DomUtils';

const BLOCK_BUTTONS: { name: string; tag: string; icon: string; tooltip: string }[] = [
  { name: 'paragraph', tag: 'p', icon: 'paragraph', tooltip: 'Paragraph' },
  { name: 'h1', tag: 'h1', icon: 'h1', tooltip: 'Heading 1' },
  { name: 'h2', tag: 'h2', icon: 'h2', tooltip: 'Heading 2' },
  { name: 'h3', tag: 'h3', icon: 'h3', tooltip: 'Heading 3' },
  { name: 'h4', tag: 'h4', icon: 'h4', tooltip: 'Heading 4' },
  { name: 'h5', tag: 'h5', icon: 'h5', tooltip: 'Heading 5' },
  { name: 'h6', tag: 'h6', icon: 'h6', tooltip: 'Heading 6' },
  { name: 'blockquote', tag: 'blockquote', icon: 'blockquote', tooltip: 'Quote' },
  { name: 'preformatted', tag: 'pre', icon: 'sourcecode', tooltip: 'Preformatted' }
];

function selectedBlockTag(editor: Parameters<Plugin['init']>[0]): string {
  const range = editor.selection.getRange();
  if (!range) return '';
  const tags = blocksInRange(range, editor.getBody()).map((block) => block.tagName.toLowerCase());
  return tags.length && tags.every((tag) => tag === tags[0]) ? tags[0]! : '';
}

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
        const blocks = blocksInRange(range, ed.getBody());
        // List items are structural containers. Replacing an LI with a heading
        // would create invalid list HTML, so list-block formatting is left for
        // a future nested-block list model.
        for (const block of blocks.filter((candidate) => candidate.tagName !== 'LI')) {
          transformBlock(block, tag.toLowerCase(), ed.getBody());
        }
        ed.selection.moveToBookmark(bookmark);
        ed.events.emit('change', ed.getContent());
      },
      queryValue: (ed) => selectedBlockTag(ed)
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
      editor.ui.addToggleButton(b.name, {
        icon: b.icon,
        tooltip: b.tooltip,
        command: `FormatBlock:${b.tag}`
      });
      editor.ui.addMenuItem(b.name, {
        menu: 'format',
        text: b.tooltip,
        command: `FormatBlock:${b.tag}`
      });
    }

    editor.ui.addButton('blockstyle', {
      type: 'menu',
      icon: 'paragraph',
      tooltip: 'Block style',
      valueCommand: 'FormatBlock',
      showLabel: true,
      items: BLOCK_BUTTONS.map((block) => ({
        value: block.tag,
        label: block.tooltip,
        icon: block.icon,
        command: `FormatBlock:${block.tag}`
      }))
    });
  }
};

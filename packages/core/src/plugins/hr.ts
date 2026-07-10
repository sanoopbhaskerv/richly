import type { Plugin } from './types';
import { closestBlock } from '../dom/DomUtils';

export const hrPlugin: Plugin = {
  name: 'hr',
  init(editor) {
    editor.commands.register('InsertHorizontalRule', {
      execute: (ed) => {
        const range = ed.selection.getRange();
        if (!range) return;
        const body = ed.getBody();
        const doc = body.ownerDocument;
        const hr = doc.createElement('hr');
        const block = closestBlock(range.startContainer, body);
        if (block) block.after(hr);
        else body.appendChild(hr);
        // Keep a paragraph after the rule so typing can continue.
        let next = hr.nextElementSibling as HTMLElement | null;
        if (!next) {
          next = doc.createElement('p');
          next.appendChild(doc.createElement('br'));
          hr.after(next);
        }
        ed.selection.selectNodeContents(next);
        ed.selection.collapseToEnd();
        ed.events.emit('change', ed.getContent());
      }
    });
    editor.ui.addMenuItem('hr', {
      menu: 'insert',
      text: 'Horizontal rule',
      command: 'InsertHorizontalRule'
    });
  }
};

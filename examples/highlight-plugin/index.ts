import type { Plugin } from '@richly/core';

function findMark(node: Node, root: HTMLElement): HTMLElement | null {
  let current: Node | null = node;
  while (current && current !== root) {
    if ((current as HTMLElement).tagName?.toLowerCase() === 'mark') {
      return current as HTMLElement;
    }
    current = current.parentNode;
  }
  return null;
}

export const highlightPlugin: Plugin = {
  name: 'highlight',
  init(editor) {
    editor.commands.register('Highlight', {
      execute(ed) {
        const range = ed.selection.getRange();
        if (!range || range.collapsed) return;

        const root = ed.getBody();
        const mark = findMark(range.startContainer, root);
        if (mark) {
          const parent = mark.parentNode;
          if (!parent) return;
          while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
          mark.remove();
          root.normalize();
        } else {
          const wrapper = root.ownerDocument.createElement('mark');
          wrapper.appendChild(range.extractContents());
          range.insertNode(wrapper);
          const next = root.ownerDocument.createRange();
          next.selectNodeContents(wrapper);
          ed.selection.setRange(next);
        }

        ed.events.emit('change', ed.getContent());
      },
      queryState(ed) {
        const range = ed.selection.getRange();
        if (!range) return false;
        return !!findMark(range.startContainer, ed.getBody());
      }
    });

    editor.ui.addToggleButton('highlight', {
      icon: 'visualblocks',
      tooltip: 'Highlight',
      command: 'Highlight'
    });
    editor.ui.addMenuItem('highlight', {
      menu: 'format',
      text: 'Highlight',
      command: 'Highlight'
    });
  }
};

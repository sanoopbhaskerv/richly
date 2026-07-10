import type { Plugin } from './types';
import type { Editor } from '../editor/Editor';
import { blocksInRange } from '../dom/DomUtils';
import { selectedListItems, nestListItem, unnestListItem } from './lists';

const STEP_PX = 40; // Consistent visual indent step.

function changeIndent(editor: Editor, delta: 1 | -1): void {
  const range = editor.selection.getRange();
  if (!range) return;
  const body = editor.getBody();

  // Inside a list: indent/outdent = nest/unnest items.
  const items = selectedListItems(editor);
  if (items.length) {
    // Index-path bookmarks break when the tree is restructured — track the
    // moved element itself and put the caret back inside it afterwards.
    let caretTarget: HTMLElement | null = null;
    for (const li of items) {
      if (delta === 1) caretTarget = nestListItem(li) ? li : (caretTarget ?? li);
      else caretTarget = unnestListItem(li);
    }
    if (caretTarget) {
      editor.selection.selectNodeContents(caretTarget);
      editor.selection.collapseToEnd();
    }
    editor.events.emit('change', editor.getContent());
    return;
  }

  // Plain blocks: step padding-left.
  const bookmark = editor.selection.getBookmark();
  for (const block of blocksInRange(range, body)) {
    const current = parseInt(block.style.paddingLeft || '0', 10) || 0;
    const next = Math.max(0, current + delta * STEP_PX);
    block.style.paddingLeft = next > 0 ? `${next}px` : '';
    if (!block.getAttribute('style')) block.removeAttribute('style');
  }
  editor.selection.moveToBookmark(bookmark);
  editor.events.emit('change', editor.getContent());
}

export const indentPlugin: Plugin = {
  name: 'indent',
  init(editor) {
    editor.commands.register('Indent', { execute: (ed) => changeIndent(ed, 1) });
    editor.commands.register('Outdent', { execute: (ed) => changeIndent(ed, -1) });
    editor.ui.addButton('outdent', {
      icon: 'outdent',
      tooltip: 'Decrease indent',
      command: 'Outdent'
    });
    editor.ui.addButton('indent', {
      icon: 'indent',
      tooltip: 'Increase indent',
      command: 'Indent'
    });
  }
};

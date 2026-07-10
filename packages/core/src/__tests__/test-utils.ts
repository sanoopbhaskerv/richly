import { Editor } from '../editor/Editor';

/** Canonical unit-test helpers (TESTING.md §2). */

export function createTestEditor(initialContent: string): Editor {
  const target = document.createElement('div');
  document.body.appendChild(target);
  return Editor.init({ target, initialContent, statusbar: true });
}

/** Select the first occurrence of `text` inside the editor body. */
export function selectText(editor: Editor, text: string): void {
  const body = editor.getBody();
  const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const idx = node.textContent?.indexOf(text) ?? -1;
    if (idx !== -1) {
      const range = document.createRange();
      range.setStart(node, idx);
      range.setEnd(node, idx + text.length);
      editor.selection.setRange(range);
      return;
    }
  }
  throw new Error(`selectText: "${text}" not found in editor content`);
}

export function placeCursor(editor: Editor, text: string, offsetInText = 0): void {
  selectText(editor, text);
  const range = editor.selection.getRange()!;
  range.setStart(range.startContainer, range.startOffset + offsetInText);
  range.collapse(true);
  editor.selection.setRange(range);
}

export function destroyAll(editor: Editor): void {
  editor.destroy();
  document.body.innerHTML = '';
}

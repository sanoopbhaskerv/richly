import type { Plugin } from './types';
import type { Editor } from '../editor/Editor';
import {
  applyInline,
  removeInline,
  removeAllInline,
  closestTag,
  isEmptyElement,
  CARET_FILLER
} from '../dom/DomUtils';

const INLINE_FORMATS: { name: string; command: string; tag: string; icon: string; tooltip: string; shortcut?: string }[] = [
  { name: 'bold', command: 'Bold', tag: 'strong', icon: 'bold', tooltip: 'Bold', shortcut: 'Mod+B' },
  { name: 'italic', command: 'Italic', tag: 'em', icon: 'italic', tooltip: 'Italic', shortcut: 'Mod+I' },
  { name: 'underline', command: 'Underline', tag: 'u', icon: 'underline', tooltip: 'Underline', shortcut: 'Mod+U' },
  { name: 'strikethrough', command: 'Strikethrough', tag: 's', icon: 'strikethrough', tooltip: 'Strikethrough' }
];

/**
 * Collapsed cursor: create a "caret container" — an (in)active format element
 * holding a U+FEFF filler — so text typed next is (un)formatted. Same approach
 * as TinyMCE. getContent() strips the fillers and empty containers.
 */
function toggleInlineCollapsed(editor: Editor, tag: string): void {
  const range = editor.selection.getRange();
  if (!range) return;
  const body = editor.getBody();
  const docRef = body.ownerDocument;
  const ancestor = closestTag(range.startContainer, tag, body);

  const caret = docRef.createTextNode(CARET_FILLER);
  if (!ancestor) {
    // Turn ON: caret goes inside a fresh format element.
    const el = docRef.createElement(tag);
    el.appendChild(caret);
    range.insertNode(el);
  } else {
    // Turn OFF: split the format element at the caret; caret lands between the halves.
    const rightRange = docRef.createRange();
    rightRange.setStart(range.startContainer, range.startOffset);
    rightRange.setEnd(ancestor, ancestor.childNodes.length);
    const rightFrag = rightRange.extractContents();

    const parent = ancestor.parentNode!;
    parent.insertBefore(caret, ancestor.nextSibling);
    if ((rightFrag.textContent ?? '').replace(new RegExp(CARET_FILLER, 'g'), '') !== '' || rightFrag.querySelector('img,br')) {
      const rightEl = ancestor.cloneNode(false) as HTMLElement;
      rightEl.appendChild(rightFrag);
      parent.insertBefore(rightEl, caret.nextSibling);
    }
    if (isEmptyElement(ancestor)) ancestor.remove();
  }
  const r = docRef.createRange();
  r.setStart(caret, 1);
  r.collapse(true);
  editor.selection.setRange(r);
  editor.events.emit('change', editor.getContent());
}

function toggleInline(editor: Editor, tag: string): void {
  const range = editor.selection.getRange();
  if (!range) return;
  if (range.collapsed) {
    toggleInlineCollapsed(editor, tag);
    return;
  }
  const body = editor.getBody();
  const active = !!closestTag(range.commonAncestorContainer, tag, body) || !!closestTag(range.startContainer, tag, body);
  const out = active ? removeInline(range, tag, body) : applyInline(range, tag);
  editor.selection.setRange(out);
  body.normalize();
  editor.events.emit('change', editor.getContent());
}

function inlineState(editor: Editor, tag: string): boolean {
  const range = editor.selection.getRange();
  if (!range) return false;
  return !!closestTag(range.startContainer, tag, editor.getBody());
}

export const formatsPlugin: Plugin = {
  name: 'formats',
  init(editor) {
    for (const f of INLINE_FORMATS) {
      editor.commands.register(f.command, {
        execute: (ed) => toggleInline(ed, f.tag),
        queryState: (ed) => inlineState(ed, f.tag)
      });
      editor.ui.addToggleButton(f.name, {
        icon: f.icon,
        tooltip: f.tooltip,
        command: f.command,
        shortcut: f.shortcut
      });
      editor.ui.addMenuItem(f.name, { menu: 'format', text: f.tooltip, command: f.command, shortcut: f.shortcut });
    }

    editor.commands.register('RemoveFormat', {
      execute: (ed) => {
        const range = ed.selection.getRange();
        if (!range || range.collapsed) return;
        removeAllInline(range, ed.getBody());
        ed.getBody().normalize();
        ed.events.emit('change', ed.getContent());
      }
    });
    editor.ui.addButton('removeformat', { icon: 'removeformat', tooltip: 'Clear formatting', command: 'RemoveFormat' });
    editor.ui.addMenuItem('removeformat', { menu: 'format', text: 'Clear formatting', command: 'RemoveFormat' });
  }
};

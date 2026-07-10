import type { Plugin } from './types';
import type { Editor } from '../editor/Editor';
import { applyInline, removeInline, removeAllInline, closestTag } from '../dom/DomUtils';

const INLINE_FORMATS: { name: string; command: string; tag: string; icon: string; tooltip: string; shortcut?: string }[] = [
  { name: 'bold', command: 'Bold', tag: 'strong', icon: 'bold', tooltip: 'Bold', shortcut: 'Mod+B' },
  { name: 'italic', command: 'Italic', tag: 'em', icon: 'italic', tooltip: 'Italic', shortcut: 'Mod+I' },
  { name: 'underline', command: 'Underline', tag: 'u', icon: 'underline', tooltip: 'Underline', shortcut: 'Mod+U' },
  { name: 'strikethrough', command: 'Strikethrough', tag: 's', icon: 'strikethrough', tooltip: 'Strikethrough' }
];

function toggleInline(editor: Editor, tag: string): void {
  const range = editor.selection.getRange();
  if (!range || range.collapsed) return; // TODO: collapsed-cursor pending-format state (Milestone 1 polish)
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
  }
};

import type { Plugin } from './types';

export const historyPlugin: Plugin = {
  name: 'history',
  init(editor) {
    editor.commands.register('Undo', {
      execute: (ed) => ed.undoManager.undo(),
      skipUndo: true
    });
    editor.commands.register('Redo', {
      execute: (ed) => ed.undoManager.redo(),
      skipUndo: true
    });
    editor.ui.addButton('undo', { icon: 'undo', tooltip: 'Undo', command: 'Undo', shortcut: 'Mod+Z' });
    editor.ui.addButton('redo', { icon: 'redo', tooltip: 'Redo', command: 'Redo', shortcut: 'Mod+Shift+Z' });
  }
};

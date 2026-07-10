import type { Plugin } from './types';

export const fullscreenPlugin: Plugin = {
  name: 'fullscreen',
  init(editor) {
    editor.commands.register('ToggleFullscreen', {
      execute: (ed) => {
        ed.getRoot().classList.toggle('sbe-fullscreen');
        ed.focus();
      },
      queryState: (ed) => ed.getRoot().classList.contains('sbe-fullscreen'),
      skipUndo: true // view state, not content
    });
    editor.ui.addToggleButton('fullscreen', { icon: 'fullscreen', tooltip: 'Fullscreen', command: 'ToggleFullscreen' });
    editor.ui.addMenuItem('fullscreen', { menu: 'view', text: 'Fullscreen', command: 'ToggleFullscreen' });

    editor.on('keydown', (e) => {
      if (e.key === 'Escape' && editor.getRoot().classList.contains('sbe-fullscreen')) {
        editor.execCommand('ToggleFullscreen');
      }
    });
  }
};

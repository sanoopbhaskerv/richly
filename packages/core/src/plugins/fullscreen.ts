import type { Plugin } from './types';

export const fullscreenPlugin: Plugin = {
  name: 'fullscreen',
  init(editor) {
    editor.commands.register('ToggleFullscreen', {
      execute: (ed) => {
        ed.getRoot().classList.toggle('rly-fullscreen');
        ed.focus();
      },
      queryState: (ed) => ed.getRoot().classList.contains('rly-fullscreen'),
      skipUndo: true // view state, not content
    });
    editor.ui.addToggleButton('fullscreen', {
      icon: 'fullscreen',
      tooltip: 'Fullscreen',
      command: 'ToggleFullscreen'
    });
    editor.ui.addMenuItem('fullscreen', {
      menu: 'view',
      text: 'Fullscreen',
      command: 'ToggleFullscreen'
    });

    editor.on('keydown', (e) => {
      if (e.key === 'Escape' && editor.getRoot().classList.contains('rly-fullscreen')) {
        editor.execCommand('ToggleFullscreen');
      }
    });
  }
};

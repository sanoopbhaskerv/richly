import type { Plugin } from './types';
import type { Editor } from '../editor/Editor';
import { openDialog } from '../ui/Dialog';

async function openSourceDialog(editor: Editor): Promise<void> {
  const result = await openDialog(editor, {
    name: 'code',
    title: 'Source code',
    fields: [{ name: 'code', label: 'HTML', type: 'textarea', value: editor.getContent() }],
    submitText: 'Save'
  });
  if (result !== null) editor.setContent(result.code ?? '');
}

export const sourceCodePlugin: Plugin = {
  name: 'sourcecode',
  init(editor) {
    editor.commands.register('SourceCode', {
      execute: (ed) => void openSourceDialog(ed)
    });
    editor.ui.addButton('code', {
      icon: 'sourcecode',
      tooltip: 'Source code',
      command: 'SourceCode'
    });
    editor.ui.addMenuItem('code', { menu: 'view', text: 'Source code', command: 'SourceCode' });
  }
};

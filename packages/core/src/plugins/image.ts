import type { Plugin } from './types';
import type { Editor } from '../editor/Editor';
import { openDialog } from '../ui/Dialog';

interface ImageArgs {
  src: string;
  alt?: string;
}

function currentImage(editor: Editor): HTMLImageElement | null {
  const range = editor.selection.getRange();
  if (!range) return null;
  const node = range.startContainer;
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = (node as HTMLElement).childNodes[range.startOffset];
    if (el instanceof HTMLImageElement) return el;
  }
  return node.parentElement?.closest('img') as HTMLImageElement | null;
}

async function openImageDialog(editor: Editor): Promise<void> {
  const existing = currentImage(editor);
  const result = await openDialog(editor, {
    name: 'image',
    title: existing ? 'Edit image' : 'Insert image',
    fields: [
      { name: 'src', label: 'Image URL', type: 'url', placeholder: 'https://…', value: existing?.getAttribute('src') ?? '' },
      { name: 'alt', label: 'Alternative description', value: existing?.getAttribute('alt') ?? '' }
    ],
    submitText: existing ? 'Update' : 'Insert'
  });
  if (result?.src) editor.execCommand('InsertImage', { src: result.src, alt: result.alt });
}

export const imagePlugin: Plugin = {
  name: 'image',
  init(editor) {
    editor.commands.register('InsertImage', {
      execute: (ed, args) => {
        const opts = args as ImageArgs | undefined;
        if (!opts?.src) {
          void openImageDialog(ed);
          return;
        }
        const range = ed.selection.getRange();
        if (!range) return;
        const existing = currentImage(ed);
        const doc = ed.getBody().ownerDocument;
        if (existing) {
          existing.setAttribute('src', opts.src);
          if (opts.alt !== undefined) existing.setAttribute('alt', opts.alt);
        } else {
          range.deleteContents();
          const img = doc.createElement('img');
          img.setAttribute('src', opts.src);
          img.setAttribute('alt', opts.alt ?? '');
          range.insertNode(img);
          const after = doc.createRange();
          after.setStartAfter(img);
          after.collapse(true);
          ed.selection.setRange(after);
        }
        ed.events.emit('change', ed.getContent());
      }
    });

    editor.ui.addButton('image', { icon: 'image', tooltip: 'Insert image', command: 'InsertImage' });
    editor.ui.addMenuItem('image', { menu: 'insert', text: 'Image…', command: 'InsertImage' });
  }
};

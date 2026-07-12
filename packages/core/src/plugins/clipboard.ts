import type { Editor } from '../editor/Editor';
import { sanitize } from '../model/Sanitizer';
import type { Plugin } from './types';
import { getEditorConfig } from '../editor/Editor';
import { matchesAccept, uploadAndInsert } from './image';

interface ClipboardPayload {
  html: string;
  text: string;
}

let internalClipboard: ClipboardPayload | null = null;

const INLINE_TAGS = new Set([
  'A',
  'B',
  'CODE',
  'EM',
  'I',
  'S',
  'SPAN',
  'STRONG',
  'SUB',
  'SUP',
  'U'
]);

function selectedPayload(editor: Editor): ClipboardPayload | null {
  const range = editor.selection.getRange();
  const body = editor.getBody();
  if (!range || range.collapsed || !body.contains(range.commonAncestorContainer)) return null;

  const doc = body.ownerDocument;
  const container = doc.createElement('div');
  container.appendChild(range.cloneContents());

  // Range.cloneContents() omits inline ancestors when only their text is selected.
  // Rebuild those wrappers so copied bold/link/etc. formatting survives a paste.
  let ancestor =
    range.startContainer.nodeType === (doc.defaultView?.Node.ELEMENT_NODE ?? 1)
      ? (range.startContainer as Element)
      : range.startContainer.parentElement;
  let html = container.innerHTML;
  while (ancestor && ancestor !== body && INLINE_TAGS.has(ancestor.tagName)) {
    const wrapper = ancestor.cloneNode(false) as HTMLElement;
    wrapper.innerHTML = html;
    html = wrapper.outerHTML;
    ancestor = ancestor.parentElement;
  }

  return { html, text: range.toString() };
}

async function writeSystemClipboard(editor: Editor, payload: ClipboardPayload): Promise<void> {
  const view = editor.getBody().ownerDocument.defaultView;
  const clipboard = view?.navigator.clipboard;
  if (!clipboard) return;

  try {
    if (clipboard.write && view?.ClipboardItem) {
      await clipboard.write([
        new view.ClipboardItem({
          'text/html': new Blob([payload.html], { type: 'text/html' }),
          'text/plain': new Blob([payload.text], { type: 'text/plain' })
        })
      ]);
    } else if (clipboard.writeText) {
      await clipboard.writeText(payload.text);
    }
  } catch {
    // The internal clipboard keeps editor copy/cut/paste functional when the
    // browser blocks clipboard access or requires a permission prompt.
  }
}

async function readSystemClipboard(editor: Editor): Promise<ClipboardPayload | null> {
  const view = editor.getBody().ownerDocument.defaultView;
  const clipboard = view?.navigator.clipboard;
  if (!clipboard) return null;

  try {
    if (clipboard.read) {
      const items = await clipboard.read();
      for (const item of items) {
        const htmlType = item.types.includes('text/html') ? 'text/html' : null;
        const textType = item.types.includes('text/plain') ? 'text/plain' : null;
        const html = htmlType ? await (await item.getType(htmlType)).text() : '';
        const text = textType ? await (await item.getType(textType)).text() : '';
        if (html || text) return { html, text };
      }
    }
    if (clipboard.readText) {
      const text = await clipboard.readText();
      if (text) return { html: '', text };
    }
  } catch {
    // Fall through to the in-memory payload captured by copy/cut.
  }
  return null;
}

function insertPayload(editor: Editor, payload: ClipboardPayload): void {
  const range = editor.selection.getRange();
  if (!range) return;
  const doc = editor.getBody().ownerDocument;
  const template = doc.createElement('template');
  if (payload.html) {
    template.innerHTML = sanitize(payload.html, doc);
  } else {
    const escaped = doc.createElement('div');
    escaped.textContent = payload.text;
    template.innerHTML = escaped.innerHTML.replace(/\n/g, '<br>');
  }

  range.deleteContents();
  const fragment = template.content;
  const last = fragment.lastChild;
  range.insertNode(fragment);
  if (last) {
    const next = doc.createRange();
    next.setStartAfter(last);
    next.collapse(true);
    editor.selection.setRange(next);
  }
  editor.events.emit('change', editor.getContent());
}

function copy(editor: Editor): void {
  const payload = selectedPayload(editor);
  if (!payload) return;
  internalClipboard = payload;
  void writeSystemClipboard(editor, payload);
}

function cut(editor: Editor): void {
  const payload = selectedPayload(editor);
  const range = editor.selection.getRange();
  if (!payload || !range) return;
  internalClipboard = payload;
  void writeSystemClipboard(editor, payload);
  range.deleteContents();
  editor.events.emit('change', editor.getContent());
}

async function paste(editor: Editor): Promise<void> {
  const payload = (await readSystemClipboard(editor)) ?? internalClipboard;
  if (payload) insertPayload(editor, payload);
}

function selectAll(editor: Editor): void {
  editor.selection.selectNodeContents(editor.getBody());
  editor.events.emit('selectionchange', undefined);
}

export const clipboardPlugin: Plugin = {
  name: 'clipboard',
  init(editor) {
    editor.commands.register('SelectAll', { execute: selectAll, skipUndo: true });
    editor.commands.register('Copy', { execute: copy, skipUndo: true });
    editor.commands.register('Cut', { execute: cut });
    editor.commands.register('Paste', { execute: (ed) => void paste(ed) });

    editor.ui.addButton('selectall', {
      icon: 'selectall',
      tooltip: 'Select all',
      command: 'SelectAll',
      shortcut: 'Mod+A'
    });
    editor.ui.addButton('copy', {
      icon: 'copy',
      tooltip: 'Copy',
      command: 'Copy',
      shortcut: 'Mod+C'
    });
    editor.ui.addButton('cut', { icon: 'cut', tooltip: 'Cut', command: 'Cut', shortcut: 'Mod+X' });
    editor.ui.addButton('paste', {
      icon: 'paste',
      tooltip: 'Paste',
      command: 'Paste',
      shortcut: 'Mod+V'
    });

    editor.ui.addMenuItem('selectall', {
      menu: 'edit',
      text: 'Select all',
      command: 'SelectAll',
      shortcut: 'Mod+A'
    });
    editor.ui.addMenuItem('copy', {
      menu: 'edit',
      text: 'Copy',
      command: 'Copy',
      shortcut: 'Mod+C'
    });
    editor.ui.addMenuItem('cut', { menu: 'edit', text: 'Cut', command: 'Cut', shortcut: 'Mod+X' });
    editor.ui.addMenuItem('paste', {
      menu: 'edit',
      text: 'Paste',
      command: 'Paste',
      shortcut: 'Mod+V'
    });

    const capture = (): void => {
      const payload = selectedPayload(editor);
      if (payload) internalClipboard = payload;
    };

    const uploadableFiles = (files: FileList | null): File[] => {
      const { upload, accept = 'image/*' } = getEditorConfig(editor).images ?? {};
      if (!upload || !files?.length) return [];
      return Array.from(files).filter((file) => matchesAccept(file, accept));
    };

    const onPasteFiles = (event: ClipboardEvent): void => {
      const files = uploadableFiles(event.clipboardData?.files ?? null);
      if (!files.length) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      void (async () => {
        for (const file of files) await uploadAndInsert(editor, file);
      })();
    };

    const body = editor.getBody();
    body.addEventListener('paste', onPasteFiles);
    body.addEventListener('copy', capture);
    body.addEventListener('cut', capture);
    editor.events.on('destroy', () => {
      body.removeEventListener('paste', onPasteFiles);
      body.removeEventListener('copy', capture);
      body.removeEventListener('cut', capture);
    });
  }
};

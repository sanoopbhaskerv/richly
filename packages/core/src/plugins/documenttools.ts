import type { Editor } from '../editor/Editor';
import { openDialog } from '../ui/Dialog';
import type { Plugin } from './types';

export interface FindReplaceArgs {
  find: string;
  replace?: string;
  action?: 'find' | 'replace' | 'replaceAll';
  caseSensitive?: boolean;
  wholeWord?: boolean;
}

function expression(args: FindReplaceArgs): RegExp | null {
  if (!args.find) return null;
  const escaped = args.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(args.wholeWord ? `\\b${escaped}\\b` : escaped, args.caseSensitive ? 'g' : 'gi');
}

function textNodes(editor: Editor): Text[] {
  const body = editor.getBody();
  const view = body.ownerDocument.defaultView;
  const walker = body.ownerDocument.createTreeWalker(body, view?.NodeFilter.SHOW_TEXT ?? 4, {
    acceptNode: (node) =>
      node.parentElement?.closest('script,style')
        ? (view?.NodeFilter.FILTER_REJECT ?? 2)
        : (view?.NodeFilter.FILTER_ACCEPT ?? 1)
  });
  const nodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) nodes.push(node as Text);
  return nodes;
}

function findNext(editor: Editor, args: FindReplaceArgs): Range | null {
  const regex = expression(args);
  if (!regex) return null;
  const nodes = textNodes(editor);
  const current = editor.selection.getRange();
  const startIndex = current ? Math.max(0, nodes.indexOf(current.endContainer as Text)) : 0;
  const ordered = [...nodes.slice(startIndex), ...nodes.slice(0, startIndex)];
  for (const node of ordered) {
    regex.lastIndex = node === current?.endContainer ? current.endOffset : 0;
    let match = regex.exec(node.data);
    if (!match && node === current?.endContainer) {
      regex.lastIndex = 0;
      match = regex.exec(node.data);
    }
    if (!match) continue;
    const range = node.ownerDocument.createRange();
    range.setStart(node, match.index);
    range.setEnd(node, match.index + match[0].length);
    editor.selection.setRange(range);
    node.parentElement?.scrollIntoView?.({ block: 'nearest' });
    editor.events.emit('selectionchange', undefined);
    return range;
  }
  return null;
}

function runFindReplace(editor: Editor, args: FindReplaceArgs): number {
  const regex = expression(args);
  if (!regex) return 0;
  if (args.action === 'find' || !args.action) return findNext(editor, args) ? 1 : 0;
  if (args.action === 'replace') {
    const range = findNext(editor, args);
    if (!range) return 0;
    range.deleteContents();
    const replacement = range.startContainer.ownerDocument!.createTextNode(args.replace ?? '');
    range.insertNode(replacement);
    const after = replacement.ownerDocument.createRange();
    after.setStartAfter(replacement);
    after.collapse(true);
    editor.selection.setRange(after);
    editor.events.emit('change', editor.getContent());
    return 1;
  }

  let count = 0;
  for (const node of textNodes(editor)) {
    regex.lastIndex = 0;
    const matches = node.data.match(regex);
    if (!matches?.length) continue;
    count += matches.length;
    node.data = node.data.replace(regex, args.replace ?? '');
  }
  if (count) editor.events.emit('change', editor.getContent());
  return count;
}

async function openFindReplace(editor: Editor): Promise<void> {
  const selected = editor.selection.getRange()?.toString() ?? '';
  const result = await openDialog(editor, {
    name: 'find-replace',
    title: 'Search and replace',
    description: 'Find text in the document, replace one match, or replace every match.',
    fields: [
      { name: 'find', label: 'Find', value: selected },
      { name: 'replace', label: 'Replace with' },
      {
        name: 'action',
        label: 'Action',
        type: 'select',
        value: 'find',
        options: [
          { value: 'find', label: 'Find next' },
          { value: 'replace', label: 'Replace next' },
          { value: 'replaceAll', label: 'Replace all' }
        ]
      },
      { name: 'caseSensitive', label: 'Match case', type: 'checkbox' },
      { name: 'wholeWord', label: 'Whole words only', type: 'checkbox' }
    ],
    submitText: 'Run',
    layout: 'grid'
  });
  if (!result) return;
  runFindReplace(editor, {
    find: result.find ?? '',
    replace: result.replace ?? '',
    action: result.action as FindReplaceArgs['action'],
    caseSensitive: result.caseSensitive === 'true',
    wholeWord: result.wholeWord === 'true'
  });
}

function openPreview(editor: Editor): void {
  const doc = editor.getBody().ownerDocument;
  const overlay = doc.createElement('div');
  overlay.className = 'rly-preview-overlay';
  overlay.dataset.testid = 'preview-overlay';
  const dialog = doc.createElement('div');
  dialog.className = 'rly-preview-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', 'Document preview');
  const header = doc.createElement('div');
  header.className = 'rly-preview-header';
  const title = doc.createElement('strong');
  title.textContent = 'Document preview';
  const close = doc.createElement('button');
  close.type = 'button';
  close.dataset.testid = 'preview-close';
  close.setAttribute('aria-label', 'Close preview');
  close.textContent = '×';
  const frame = doc.createElement('iframe');
  frame.className = 'rly-preview-frame';
  frame.dataset.testid = 'preview-frame';
  frame.title = 'Document preview';
  frame.setAttribute('sandbox', '');
  frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><style>body{max-width:760px;margin:32px auto;padding:0 24px;font:16px/1.65 system-ui;color:#1f2733}img{max-width:100%}table{border-collapse:collapse;width:100%}td,th{border:1px solid #d8dce3;padding:8px}blockquote{border-left:3px solid #3574f0;padding-left:16px}</style></head><body>${editor.getContent()}</body></html>`;
  header.append(title, close);
  dialog.append(header, frame);
  overlay.appendChild(dialog);
  const dismiss = (): void => {
    doc.removeEventListener('keydown', onKeyDown, true);
    overlay.remove();
    editor.focus();
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') dismiss();
  };
  close.addEventListener('click', dismiss);
  overlay.addEventListener('mousedown', (event) => {
    if (event.target === overlay) dismiss();
  });
  doc.addEventListener('keydown', onKeyDown, true);
  doc.body.appendChild(overlay);
  close.focus();
}

export const documentToolsPlugin: Plugin = {
  name: 'documenttools',
  init(editor) {
    editor.commands.register('FindReplace', {
      execute: (ed, args) => {
        if (args) runFindReplace(ed, args as FindReplaceArgs);
        else void openFindReplace(ed);
      }
    });
    editor.commands.register('Preview', { execute: openPreview, skipUndo: true });
    editor.commands.register('VisualBlocks', {
      execute: (ed) => ed.getBody().classList.toggle('rly-visual-blocks'),
      queryState: (ed) => ed.getBody().classList.contains('rly-visual-blocks'),
      skipUndo: true
    });

    editor.ui.addButton('findreplace', {
      icon: 'search',
      tooltip: 'Search and replace',
      command: 'FindReplace',
      shortcut: 'Mod+F'
    });
    editor.ui.addButton('preview', { icon: 'preview', tooltip: 'Preview', command: 'Preview' });
    editor.ui.addToggleButton('visualblocks', {
      icon: 'visualblocks',
      tooltip: 'Visual blocks',
      command: 'VisualBlocks'
    });
    editor.ui.addMenuItem('findreplace', {
      menu: 'edit',
      text: 'Search and replace…',
      command: 'FindReplace',
      shortcut: 'Mod+F'
    });
    editor.ui.addMenuItem('preview', { menu: 'view', text: 'Preview', command: 'Preview' });
    editor.ui.addMenuItem('visualblocks', {
      menu: 'view',
      text: 'Visual blocks',
      command: 'VisualBlocks'
    });
  }
};

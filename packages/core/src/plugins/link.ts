import type { Plugin } from './types';
import type { Editor } from '../editor/Editor';
import {
  applyInline,
  closestTag,
  closestTagInRange,
  combineRanges,
  inlineRangesForBlocks,
  unwrap
} from '../dom/DomUtils';
import { openDialog } from '../ui/Dialog';

interface LinkArgs {
  href: string;
  text?: string;
  openInNewTab?: boolean;
}

function normalizeHref(href: string): string {
  return /^www\./i.test(href) ? `https://${href}` : href;
}

function currentLink(editor: Editor): HTMLElement | null {
  const range = editor.selection.getRange();
  if (!range) return null;
  return closestTagInRange(range, 'a', editor.getBody());
}

async function openLinkDialog(editor: Editor): Promise<void> {
  const existing = currentLink(editor);
  const result = await openDialog(editor, {
    name: 'link',
    title: existing ? 'Edit link' : 'Insert link',
    fields: [
      {
        name: 'href',
        label: 'URL',
        type: 'url',
        placeholder: 'https://example.com',
        value: existing?.getAttribute('href') ?? ''
      },
      {
        name: 'openInNewTab',
        label: 'Open in new tab',
        type: 'checkbox',
        value: String(existing?.getAttribute('target') === '_blank')
      }
    ],
    submitText: existing ? 'Update' : 'Insert'
  });
  if (result?.href) {
    editor.execCommand('InsertLink', {
      href: result.href,
      openInNewTab: result.openInNewTab === 'true'
    });
  }
}

function setLinkAttributes(link: HTMLElement, href: string, openInNewTab?: boolean): void {
  link.setAttribute('href', href);
  if (openInNewTab === true) {
    link.setAttribute('target', '_blank');
    const rel = new Set((link.getAttribute('rel') ?? '').split(/\s+/).filter(Boolean));
    rel.delete('opener');
    rel.add('noopener');
    rel.add('noreferrer');
    link.setAttribute('rel', [...rel].join(' '));
  } else if (openInNewTab === false) {
    link.removeAttribute('target');
  }
}

function insertLink(editor: Editor, args: LinkArgs): void {
  const range = editor.selection.getRange();
  if (!range) return;
  const href = normalizeHref(args.href);

  const existing = currentLink(editor);
  if (existing) {
    setLinkAttributes(existing, href, args.openInNewTab);
    if (args.text) existing.textContent = args.text;
  } else if (range.collapsed) {
    const doc = editor.getBody().ownerDocument;
    const a = doc.createElement('a');
    setLinkAttributes(a, href, args.openInNewTab);
    a.textContent = args.text || args.href;
    range.insertNode(a);
    const after = doc.createRange();
    after.setStartAfter(a);
    after.collapse(true);
    editor.selection.setRange(after);
  } else {
    // Per block so a cross-block selection yields one <a> per paragraph rather
    // than an <a> illegally wrapping block elements.
    const subRanges = inlineRangesForBlocks(range, editor.getBody());
    const outRanges = subRanges.map((subRange) => {
      const out = applyInline(subRange, 'a');
      setLinkAttributes(out.commonAncestorContainer as HTMLElement, href, args.openInNewTab);
      return out;
    });
    if (outRanges.length) editor.selection.setRange(combineRanges(outRanges));
  }
  editor.events.emit('change', editor.getContent());
}

/** Wrap a URL typed just before the caret in a link (triggered on space/Enter). */
function autolink(editor: Editor): boolean {
  const range = editor.selection.getRange();
  if (!range?.collapsed) return false;
  const node = range.startContainer;
  if (node.nodeType !== Node.TEXT_NODE) return false;
  const body = editor.getBody();
  if (closestTag(node, 'a', body) || closestTag(node, 'pre', body)) return false;

  const text = (node as Text).data.slice(0, range.startOffset);
  const match = /(https?:\/\/[^\s]+|www\.[^\s.][^\s]*)$/i.exec(text);
  if (!match) return false;

  editor.undoManager.snapshot();
  const doc = body.ownerDocument;
  const urlRange = doc.createRange();
  urlRange.setStart(node, match.index);
  urlRange.setEnd(node, range.startOffset);
  const a = doc.createElement('a');
  a.setAttribute('href', normalizeHref(match[0]));
  a.appendChild(urlRange.extractContents());
  urlRange.insertNode(a);

  const after = doc.createRange();
  after.setStartAfter(a);
  after.collapse(true);
  editor.selection.setRange(after);
  editor.events.emit('change', editor.getContent());
  return true;
}

export const linkPlugin: Plugin = {
  name: 'link',
  init(editor) {
    editor.commands.register('InsertLink', {
      execute: (ed, args) => {
        if (!(args as LinkArgs | undefined)?.href) {
          void openLinkDialog(ed);
          return;
        }
        insertLink(ed, args as LinkArgs);
      },
      queryState: (ed) => !!currentLink(ed)
    });

    editor.commands.register('Unlink', {
      execute: (ed) => {
        const a = currentLink(ed);
        if (!a) return;
        unwrap(a);
        ed.getBody().normalize();
        ed.events.emit('change', ed.getContent());
      }
    });

    editor.ui.addToggleButton('link', {
      icon: 'link',
      tooltip: 'Insert link',
      command: 'InsertLink',
      shortcut: 'Mod+K'
    });
    editor.ui.addButton('unlink', { icon: 'unlink', tooltip: 'Remove link', command: 'Unlink' });
    editor.ui.addMenuItem('link', {
      menu: 'insert',
      text: 'Link…',
      command: 'InsertLink',
      shortcut: 'Mod+K'
    });

    editor.on('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        editor.execCommand('InsertLink');
      } else if (e.key === ' ' || e.key === 'Enter') {
        autolink(editor);
      }
    });
  }
};

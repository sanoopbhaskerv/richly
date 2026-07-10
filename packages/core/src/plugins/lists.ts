import type { Plugin } from './types';
import type { Editor } from '../editor/Editor';
import { blocksInRange, closestTag, isEmptyElement } from '../dom/DomUtils';

type ListTag = 'ul' | 'ol';

function doc(el: Element): Document {
  return el.ownerDocument;
}

/** All selected leaf <li> elements. */
export function selectedListItems(editor: Editor): HTMLElement[] {
  const range = editor.selection.getRange();
  if (!range) return [];
  const items = blocksInRange(range, editor.getBody()).map((b) =>
    b.tagName === 'LI' ? b : (closestTag(b, 'li', editor.getBody()) ?? b)
  );
  return [...new Set(items)].filter((b) => b.tagName === 'LI');
}

/** Convert an <li> to a <p> placed at the list's level, splitting the list around it. */
export function outdentToParagraph(li: HTMLElement): HTMLElement {
  const list = li.parentElement as HTMLElement; // ul/ol
  const parent = list.parentNode!;
  const after = list.cloneNode(false) as HTMLElement;
  while (li.nextSibling) after.appendChild(li.nextSibling);

  const p = doc(li).createElement('p');
  while (li.firstChild) p.appendChild(li.firstChild);
  li.remove();

  parent.insertBefore(p, list.nextSibling);
  if (after.childNodes.length) parent.insertBefore(after, p.nextSibling);
  if (!list.childNodes.length) list.remove();
  return p;
}

/** Nest an <li> under its previous sibling (Tab). No-op for the first item. */
export function nestListItem(li: HTMLElement): boolean {
  const prev = li.previousElementSibling;
  if (!prev || prev.tagName !== 'LI') return false;
  const parentTag = (li.parentElement as HTMLElement).tagName.toLowerCase();
  let sub = prev.lastElementChild;
  if (!sub || (sub.tagName !== 'UL' && sub.tagName !== 'OL')) {
    sub = doc(li).createElement(parentTag);
    prev.appendChild(sub);
  }
  sub.appendChild(li);
  return true;
}

/** Un-nest an <li> one level (Shift+Tab). At top level, converts to <p>. Returns the element holding the content. */
export function unnestListItem(li: HTMLElement): HTMLElement {
  const list = li.parentElement as HTMLElement;
  const parentLi = list.parentElement?.closest('li') as HTMLElement | null;
  if (!parentLi) {
    return outdentToParagraph(li);
  }
  // Following siblings become a nested list inside the moved item.
  const following = list.cloneNode(false) as HTMLElement;
  while (li.nextSibling) following.appendChild(li.nextSibling);
  if (following.childNodes.length) li.appendChild(following);
  parentLi.parentElement!.insertBefore(li, parentLi.nextSibling);
  if (!list.childNodes.length) list.remove();
  return li;
}

function toggleList(editor: Editor, tag: ListTag): void {
  const range = editor.selection.getRange();
  if (!range) return;
  const body = editor.getBody();
  const li = closestTag(range.startContainer, 'li', body);
  const currentList = li?.parentElement as HTMLElement | undefined;

  let caretTarget: HTMLElement | null = null;

  if (li && currentList) {
    if (currentList.tagName.toLowerCase() === tag) {
      // Toggle OFF: selected items become paragraphs.
      const items = selectedListItems(editor);
      const ps = (items.length ? items : [li]).map((item) => outdentToParagraph(item));
      caretTarget = ps[0] ?? null;
    } else {
      // Switch list type in place.
      const replacement = doc(currentList).createElement(tag);
      while (currentList.firstChild) replacement.appendChild(currentList.firstChild);
      currentList.parentNode!.replaceChild(replacement, currentList);
      caretTarget = replacement.querySelector('li');
    }
  } else {
    // Toggle ON: wrap selected blocks in a new list.
    const blocks = blocksInRange(range, body).filter((b) => b.tagName !== 'LI');
    if (!blocks.length) return;
    const list = doc(blocks[0]!).createElement(tag);
    blocks[0]!.parentNode!.insertBefore(list, blocks[0]!);
    for (const block of blocks) {
      const item = doc(block).createElement('li');
      while (block.firstChild) item.appendChild(block.firstChild);
      list.appendChild(item);
      block.remove();
    }
    caretTarget = list.querySelector('li');
  }

  if (caretTarget) {
    editor.selection.selectNodeContents(caretTarget);
    editor.selection.collapseToEnd();
  }
  editor.getBody().normalize();
  editor.events.emit('change', editor.getContent());
}

function listState(editor: Editor, tag: ListTag): boolean {
  const range = editor.selection.getRange();
  if (!range) return false;
  const li = closestTag(range.startContainer, 'li', editor.getBody());
  return li?.parentElement?.tagName.toLowerCase() === tag;
}

export const listsPlugin: Plugin = {
  name: 'lists',
  init(editor) {
    editor.commands.register('InsertUnorderedList', {
      execute: (ed) => toggleList(ed, 'ul'),
      queryState: (ed) => listState(ed, 'ul')
    });
    editor.commands.register('InsertOrderedList', {
      execute: (ed) => toggleList(ed, 'ol'),
      queryState: (ed) => listState(ed, 'ol')
    });
    editor.ui.addToggleButton('bullist', { icon: 'bullist', tooltip: 'Bullet list', command: 'InsertUnorderedList' });
    editor.ui.addToggleButton('numlist', { icon: 'numlist', tooltip: 'Numbered list', command: 'InsertOrderedList' });

    editor.on('keydown', (e) => {
      const range = editor.selection.getRange();
      if (!range) return;
      const li = closestTag(range.startContainer, 'li', editor.getBody());
      if (!li) return;

      if (e.key === 'Tab') {
        e.preventDefault();
        editor.execCommand(e.shiftKey ? 'Outdent' : 'Indent');
      } else if (e.key === 'Enter' && !e.shiftKey && isEmptyElement(li)) {
        // Enter on an empty item exits the list (TinyMCE behavior).
        e.preventDefault();
        editor.execCommand('Outdent');
      }
    });
  }
};

import type { Plugin } from './types';
import type { Editor, ListStyleOption } from '../editor/Editor';
import { getEditorConfig } from '../editor/Editor';
import { blocksInRange, closestTag, isEmptyElement } from '../dom/DomUtils';

type ListTag = 'ul' | 'ol';

interface ApplyListArgs {
  kind: ListTag;
  style?: string;
}

const DEFAULT_BULLET_STYLES: ListStyleOption[] = [
  { label: 'Disc bullet', value: 'disc' },
  { label: 'Circle bullet', value: 'circle' },
  { label: 'Square bullet', value: 'square' }
];
const DEFAULT_NUMBER_STYLES: ListStyleOption[] = [
  { label: 'Decimal (1, 2, 3)', value: 'decimal' },
  { label: 'Lower alpha (a, b, c)', value: 'lower-alpha' },
  { label: 'Upper alpha (A, B, C)', value: 'upper-alpha' },
  { label: 'Lower Roman (i, ii, iii)', value: 'lower-roman' },
  { label: 'Upper Roman (I, II, III)', value: 'upper-roman' },
  { label: 'Leading zero (01, 02, 03)', value: 'decimal-leading-zero' }
];
const SUPPORTED_LIST_STYLES = new Set(
  [...DEFAULT_BULLET_STYLES, ...DEFAULT_NUMBER_STYLES].map(({ value }) => value)
);

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

/** Return each UL/OL owning a selected list item, without duplicate ancestors. */
function selectedLists(editor: Editor): HTMLElement[] {
  return [
    ...new Set(
      selectedListItems(editor)
        .map((item) => item.parentElement)
        .filter((list): list is HTMLElement => list?.tagName === 'UL' || list?.tagName === 'OL')
    )
  ];
}

/** Replace a list's kind without moving or recreating any LI descendants. */
function convertList(list: HTMLElement, tag: ListTag): HTMLElement {
  if (list.tagName.toLowerCase() === tag) return list;
  const replacement = doc(list).createElement(tag);
  for (const attribute of Array.from(list.attributes)) {
    replacement.setAttribute(attribute.name, attribute.value);
  }
  while (list.firstChild) replacement.appendChild(list.firstChild);
  list.parentNode!.replaceChild(replacement, list);
  return replacement;
}

/** Keep default markers out of serialized HTML while preserving a stable queried value. */
function setListStyle(list: HTMLElement, tag: ListTag, style?: string): void {
  const fallback = tag === 'ul' ? 'disc' : 'decimal';
  const value = style && SUPPORTED_LIST_STYLES.has(style) ? style : fallback;
  list.style.listStyleType = value === fallback ? '' : value;
  if (!list.getAttribute('style')) list.removeAttribute('style');
}

/**
 * Apply a list kind and marker to the selection. Existing owning lists are
 * updated once; ordinary selected blocks are wrapped without placing spans or
 * other invalid elements between the list and its LI children.
 */
function applyList(editor: Editor, tag: ListTag, style?: string): void {
  const range = editor.selection.getRange();
  if (!range) return;
  const body = editor.getBody();
  const ordinaryBlocks = blocksInRange(range, body).filter((block) => block.tagName !== 'LI');
  const lists = selectedLists(editor);
  let caretTarget: HTMLElement | null = null;
  let replacedStructure = ordinaryBlocks.length > 0;

  for (const current of lists) {
    replacedStructure ||= current.tagName.toLowerCase() !== tag;
    const updated = convertList(current, tag);
    setListStyle(updated, tag, style);
    caretTarget ??= updated.querySelector('li');
  }

  // A selection may cross from a list into ordinary paragraphs. Wrap only the
  // non-list leaf blocks and leave already-owned items in their existing list.
  if (ordinaryBlocks.length) {
    const list = doc(ordinaryBlocks[0]!).createElement(tag);
    setListStyle(list, tag, style);
    ordinaryBlocks[0]!.parentNode!.insertBefore(list, ordinaryBlocks[0]!);
    for (const block of ordinaryBlocks) {
      const item = doc(block).createElement('li');
      while (block.firstChild) item.appendChild(block.firstChild);
      list.appendChild(item);
      block.remove();
    }
    caretTarget ??= list.querySelector('li');
  }

  if (caretTarget && replacedStructure) {
    // Wrapping or changing UL/OL replaces a structural node, so selection path
    // bookmarks are stale. Place a deterministic caret in the resulting list;
    // marker-only changes keep the browser's live Range untouched.
    editor.selection.selectNodeContents(caretTarget);
    editor.selection.collapseToEnd();
  }
  editor.getBody().normalize();
  editor.events.emit('change', editor.getContent());
}

/** Remove selected list items while splitting surrounding lists as required. */
function removeList(editor: Editor): void {
  const items = selectedListItems(editor);
  if (!items.length) return;
  const paragraphs = items.map((item) => outdentToParagraph(item));
  const first = paragraphs[0];
  if (first) {
    editor.selection.selectNodeContents(first);
    editor.selection.collapseToEnd();
  }
  editor.getBody().normalize();
  editor.events.emit('change', editor.getContent());
}

/** Toggle a list kind; a selection already entirely in that kind is removed. */
function toggleList(editor: Editor, tag: ListTag, style?: string): void {
  const lists = selectedLists(editor);
  if (lists.length && lists.every((list) => list.tagName.toLowerCase() === tag)) {
    removeList(editor);
  } else {
    applyList(editor, tag, style);
  }
}

function listState(editor: Editor, tag: ListTag): boolean {
  const range = editor.selection.getRange();
  if (!range) return false;
  const li = closestTag(range.startContainer, 'li', editor.getBody());
  return li?.parentElement?.tagName.toLowerCase() === tag;
}

/** Return the common marker for a selected list kind, or empty for mixed/non-list selections. */
function selectedListStyle(editor: Editor, tag: ListTag): string {
  const lists = selectedLists(editor);
  if (!lists.length || lists.some((list) => list.tagName.toLowerCase() !== tag)) return '';
  const fallback = tag === 'ul' ? 'disc' : 'decimal';
  const styles = lists.map((list) => list.style.listStyleType || fallback);
  return styles.every((style) => style === styles[0]) ? styles[0]! : '';
}

/** Filter configuration against Richly's standards-based marker allowlist. */
function listStyleOptions(editor: Editor, tag: ListTag): ListStyleOption[] {
  const defaults = tag === 'ul' ? DEFAULT_BULLET_STYLES : DEFAULT_NUMBER_STYLES;
  const configured =
    tag === 'ul'
      ? getEditorConfig(editor).listStyles?.bullets
      : getEditorConfig(editor).listStyles?.numbers;
  const source = configured ?? defaults;
  const unique = new Map<string, ListStyleOption>();
  for (const option of source) {
    if (!SUPPORTED_LIST_STYLES.has(option.value)) continue;
    unique.set(option.value, { label: option.label.trim() || option.value, value: option.value });
  }
  return [...unique.values()];
}

export const listsPlugin: Plugin = {
  name: 'lists',
  init(editor) {
    editor.commands.register('InsertUnorderedList', {
      execute: (ed, args) => toggleList(ed, 'ul', (args as ApplyListArgs | undefined)?.style),
      queryState: (ed) => listState(ed, 'ul')
    });
    editor.commands.register('InsertOrderedList', {
      execute: (ed, args) => toggleList(ed, 'ol', (args as ApplyListArgs | undefined)?.style),
      queryState: (ed) => listState(ed, 'ol')
    });
    editor.commands.register('ApplyList', {
      execute: (ed, args) => {
        const request = args as ApplyListArgs | undefined;
        if (request?.kind === 'ul' || request?.kind === 'ol') {
          applyList(ed, request.kind, request.style);
        }
      }
    });
    editor.commands.register('RemoveList', { execute: (ed) => removeList(ed) });
    editor.commands.register('BulletListStyle', {
      execute: () => undefined,
      queryValue: (ed) => selectedListStyle(ed, 'ul')
    });
    editor.commands.register('NumberListStyle', {
      execute: () => undefined,
      queryValue: (ed) => selectedListStyle(ed, 'ol')
    });
    editor.ui.addToggleButton('bullist', {
      icon: 'bullist',
      tooltip: 'Bullet list',
      command: 'InsertUnorderedList'
    });
    editor.ui.addToggleButton('numlist', {
      icon: 'numlist',
      tooltip: 'Numbered list',
      command: 'InsertOrderedList'
    });

    const splitItems = (tag: ListTag, options: ListStyleOption[]) => [
      ...options.map((option) => ({
        value: option.value,
        label: option.label,
        command: 'ApplyList',
        args: { kind: tag, style: option.value }
      })),
      {
        value: 'none',
        label: tag === 'ul' ? 'Remove bullets' : 'Remove numbering',
        command: 'RemoveList',
        repeatable: false,
        separatorBefore: true
      }
    ];
    editor.ui.addButton('bulliststyles', {
      type: 'split',
      icon: 'bullist',
      tooltip: 'Bullet list',
      command: 'InsertUnorderedList',
      args: { kind: 'ul', style: 'disc' },
      valueCommand: 'BulletListStyle',
      items: splitItems('ul', listStyleOptions(editor, 'ul'))
    });
    editor.ui.addButton('numliststyles', {
      type: 'split',
      icon: 'numlist',
      tooltip: 'Numbered list',
      command: 'InsertOrderedList',
      args: { kind: 'ol', style: 'decimal' },
      valueCommand: 'NumberListStyle',
      items: splitItems('ol', listStyleOptions(editor, 'ol'))
    });

    editor.on('keydown', (e) => {
      const range = editor.selection.getRange();
      if (!range) return;
      const li = closestTag(range.startContainer, 'li', editor.getBody());
      if (!li) return;

      if (e.key === 'Tab') {
        e.preventDefault();
        editor.execCommand(e.shiftKey ? 'Outdent' : 'Indent');
      } else if (e.key === 'Enter' && !e.shiftKey && isEmptyElement(li)) {
        // Enter on an empty item exits the list.
        e.preventDefault();
        editor.execCommand('Outdent');
      }
    });
  }
};

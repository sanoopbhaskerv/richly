import type { Editor } from '../editor/Editor';
import type { Plugin } from './types';

export interface FindReplaceArgs {
  find: string;
  replace?: string;
  action?: 'find' | 'replace' | 'replaceAll';
  caseSensitive?: boolean;
  wholeWord?: boolean;
}

/**
 * Marker attribute for transient find/replace highlights. Cleaned from
 * `getContent()` output the same way caret fillers are (see Editor.getContent).
 */
const FIND_MATCH_ATTR = 'data-rly-find-match';

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

// ---- Stateful find/replace session ----
//
// A search cycle wraps every current match in a transient <mark> and keeps
// those markers alive for the life of the cycle. Ordinals ("2 of 20") are
// fixed at cycle start; replacing a match removes only that marker and never
// re-scans the document, so replacement text that contains the query (e.g.
// `dialogue` → `dialogue23`) is never reprocessed.

interface TextMatch {
  node: Text;
  start: number;
  end: number;
}

interface SessionMatch {
  ordinal: number;
  marker: HTMLElement;
}

interface UnwrappedSessionMatch {
  match: SessionMatch;
  textNode: Text;
}

const sessions = new WeakMap<Editor, () => void>();

/** Unwrap every transient find marker under `root`, restoring plain text. */
function unwrapFindMatchMarkers(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>(`mark[${FIND_MATCH_ATTR}]`).forEach((marker) => {
    const parent = marker.parentNode;
    if (!parent) return;
    while (marker.firstChild) parent.insertBefore(marker.firstChild, marker);
    parent.removeChild(marker);
    parent.normalize();
  });
}

function collectMatches(editor: Editor, args: FindReplaceArgs): TextMatch[] {
  const regex = expression(args);
  if (!regex) return [];
  const matches: TextMatch[] = [];
  for (const node of textNodes(editor)) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(node.data))) {
      if (match[0].length === 0) {
        regex.lastIndex++;
        continue;
      }
      matches.push({ node, start: match.index, end: match.index + match[0].length });
    }
  }
  return matches;
}

/** Wrap each match in a transient <mark>. Processes right-to-left so earlier
 * offsets in a shared text node stay valid after splitting. */
function applyHighlights(cleanMatches: TextMatch[]): SessionMatch[] {
  const sessionMatches = new Array<SessionMatch>(cleanMatches.length);
  for (let index = cleanMatches.length - 1; index >= 0; index--) {
    const cleanMatch = cleanMatches[index];
    if (!cleanMatch) continue;
    const { node, start, end } = cleanMatch;
    const matchedNode = node.splitText(start);
    matchedNode.splitText(end - start);
    const marker = node.ownerDocument.createElement('mark');
    marker.setAttribute(FIND_MATCH_ATTR, 'find-match');
    marker.className = 'rly-match';
    matchedNode.replaceWith(marker);
    marker.appendChild(matchedNode);
    sessionMatches[index] = { ordinal: index + 1, marker };
  }
  return sessionMatches;
}

/** Temporarily replace every live marker with its bare text node so the undo
 * snapshot (which reads body.innerHTML) is free of transient markup. */
function temporarilyUnwrapSessionMatches(matches: SessionMatch[]): UnwrappedSessionMatch[] {
  const unwrapped: UnwrappedSessionMatch[] = [];
  for (const match of matches) {
    const marker = match.marker;
    if (!marker.isConnected) continue;
    const child = marker.firstChild;
    if (!child || child.nodeType !== Node.TEXT_NODE || !marker.parentNode) continue;
    const textNode = child as Text;
    marker.replaceWith(textNode);
    unwrapped.push({ match, textNode });
  }
  return unwrapped;
}

function restoreSessionMarker(entry: UnwrappedSessionMatch): void {
  if (!entry.textNode.isConnected) return;
  entry.textNode.replaceWith(entry.match.marker);
  entry.match.marker.replaceChildren(entry.textNode);
}

function openFindReplace(editor: Editor): void {
  // Only one panel per editor.
  sessions.get(editor)?.();

  const doc = editor.getRoot().ownerDocument;
  const selected = editor.selection.getRange()?.toString() ?? '';

  const state = {
    matches: [] as SessionMatch[],
    activeIndex: -1,
    total: 0,
    replacementCount: 0
  };

  // --- panel DOM ---
  const panel = doc.createElement('div');
  panel.className = 'rly-findreplace';
  panel.dataset.testid = 'dialog-find-replace';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Search and replace');

  const header = doc.createElement('div');
  header.className = 'rly-dialog-header';
  const title = doc.createElement('div');
  title.className = 'rly-dialog-title';
  title.textContent = 'Search and replace';
  const closeBtn = doc.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'rly-dialog-close';
  closeBtn.dataset.testid = 'dialog-close';
  closeBtn.setAttribute('aria-label', 'Close dialog');
  closeBtn.textContent = '×';
  header.append(title, closeBtn);

  const fields = doc.createElement('div');
  fields.className = 'rly-dialog-fields';

  const makeTextRow = (name: string, label: string, value = ''): HTMLInputElement => {
    const row = doc.createElement('label');
    row.className = 'rly-dialog-row';
    const span = doc.createElement('span');
    span.textContent = label;
    const input = doc.createElement('input');
    input.type = 'text';
    input.value = value;
    input.dataset.testid = `dialog-field-${name}`;
    row.append(span, input);
    fields.appendChild(row);
    return input;
  };
  const makeCheckboxRow = (name: string, label: string): HTMLInputElement => {
    const row = doc.createElement('label');
    row.className = 'rly-dialog-row rly-dialog-row-inline';
    const input = doc.createElement('input');
    input.type = 'checkbox';
    input.dataset.testid = `dialog-field-${name}`;
    const span = doc.createElement('span');
    span.textContent = label;
    row.append(input, span);
    fields.appendChild(row);
    return input;
  };

  const findInput = makeTextRow('find', 'Find', selected);
  const replaceInput = makeTextRow('replace', 'Replace with');
  const caseInput = makeCheckboxRow('caseSensitive', 'Match case');
  const wordInput = makeCheckboxRow('wholeWord', 'Whole words only');

  const count = doc.createElement('div');
  count.className = 'rly-findreplace-count';
  count.dataset.testid = 'findreplace-count';
  count.setAttribute('aria-live', 'polite');
  count.textContent = '0 of 0';

  const footer = doc.createElement('div');
  footer.className = 'rly-dialog-footer rly-findreplace-footer';
  const makeAction = (name: string, text: string, primary = false): HTMLButtonElement => {
    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.className = primary ? 'rly-dialog-btn rly-dialog-btn-primary' : 'rly-dialog-btn';
    btn.dataset.testid = `findreplace-${name}`;
    btn.textContent = text;
    footer.appendChild(btn);
    return btn;
  };
  const findBtn = makeAction('find', 'Find');
  const findNextBtn = makeAction('find-next', 'Find Next');
  const replaceBtn = makeAction('replace', 'Replace');
  const replaceAllBtn = makeAction('replace-all', 'Replace All', true);

  panel.append(header, fields, count, footer);
  doc.body.appendChild(panel);

  const readOptions = (): FindReplaceArgs => ({
    find: findInput.value,
    replace: replaceInput.value,
    caseSensitive: caseInput.checked,
    wholeWord: wordInput.checked
  });

  const clearAllHighlights = (): void => {
    unwrapFindMatchMarkers(editor.getBody());
    state.matches = [];
    state.activeIndex = -1;
    state.total = 0;
  };

  const updateCounter = (): void => {
    const current = state.matches[state.activeIndex];
    if (!current) {
      count.textContent = state.total > 0 ? `${state.total} of ${state.total}` : '0 of 0';
      return;
    }
    count.textContent = `${current.ordinal} of ${state.total}`;
  };

  const updateCurrentMatch = (): void => {
    for (const match of state.matches) match.marker.classList.remove('rly-match-current');
    const current = state.matches[state.activeIndex];
    if (!current) return;
    current.marker.classList.add('rly-match-current');
    current.marker.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  };

  const startSearchCycle = (): void => {
    clearAllHighlights();
    const cleanMatches = collectMatches(editor, readOptions());
    state.matches = applyHighlights(cleanMatches);
    state.total = state.matches.length;
    state.activeIndex = state.matches.length ? 0 : -1;
    state.replacementCount = 0;
    updateCurrentMatch();
    updateCounter();
  };

  const findNext = (): void => {
    if (!state.matches.length) return updateCounter();
    state.activeIndex = (state.activeIndex + 1) % state.matches.length;
    updateCurrentMatch();
    updateCounter();
  };

  const findPrevious = (): void => {
    if (!state.matches.length) return updateCounter();
    state.activeIndex = (state.activeIndex - 1 + state.matches.length) % state.matches.length;
    updateCurrentMatch();
    updateCounter();
  };

  const replaceCurrent = (): void => {
    const current = state.matches[state.activeIndex];
    if (!current) {
      count.textContent = 'No matches';
      return;
    }
    const replacement = readOptions().replace ?? '';
    const unwrapped = temporarilyUnwrapSessionMatches(state.matches);
    const target = unwrapped.find((entry) => entry.match === current);
    if (!target) {
      startSearchCycle();
      return;
    }
    // Live DOM is marker-free here: one clean undo level.
    editor.undoManager.snapshot(false);

    const parent = target.textNode.parentNode;
    for (const entry of unwrapped) {
      if (entry === target) entry.textNode.data = replacement;
      else restoreSessionMarker(entry);
    }

    const removedIndex = state.activeIndex;
    state.matches.splice(removedIndex, 1);
    state.replacementCount++;
    parent?.normalize();
    editor.events.emit('change', editor.getContent());

    if (!state.matches.length) {
      state.activeIndex = -1;
      count.textContent = `${state.total} of ${state.total} · complete`;
      return;
    }
    // The next original match shifted into the removed slot; wrap only if the
    // removed match was the final remaining item.
    state.activeIndex = removedIndex < state.matches.length ? removedIndex : 0;
    updateCurrentMatch();
    updateCounter();
  };

  const replaceAll = (): void => {
    const replacement = readOptions().replace ?? '';
    const unwrapped = temporarilyUnwrapSessionMatches(state.matches);
    if (!unwrapped.length) {
      count.textContent = 'Replaced 0 occurrences';
      state.matches = [];
      state.activeIndex = -1;
      return;
    }
    editor.undoManager.snapshot(false);
    const parents = new Set<Node>();
    for (const entry of unwrapped) {
      const parent = entry.textNode.parentNode;
      entry.textNode.data = replacement;
      if (parent) parents.add(parent);
    }
    parents.forEach((parent) => parent.normalize());
    state.replacementCount += unwrapped.length;
    state.matches = [];
    state.activeIndex = -1;
    editor.events.emit('change', editor.getContent());
    const n = unwrapped.length;
    count.textContent = `Replaced ${n} ${n === 1 ? 'occurrence' : 'occurrences'}`;
  };

  const restartSearch = (): void => startSearchCycle();

  // --- wiring ---
  const removers: Array<() => void> = [];
  const listen = <K extends keyof HTMLElementEventMap>(
    el: EventTarget,
    type: K,
    handler: (event: HTMLElementEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions
  ): void => {
    el.addEventListener(type, handler as EventListener, options);
    removers.push(() => el.removeEventListener(type, handler as EventListener, options));
  };

  let destroyed = false;
  const destroy = (): void => {
    if (destroyed) return;
    destroyed = true;
    removers.forEach((remove) => remove());
    removers.length = 0;
    clearAllHighlights();
    panel.remove();
    sessions.delete(editor);
  };
  sessions.set(editor, destroy);

  // Enter = Find Next, Shift+Enter = Find Previous (from either text field).
  const onNavKey = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter' || event.isComposing) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.shiftKey) findPrevious();
    else findNext();
  };
  listen(findInput, 'keydown', onNavKey);
  listen(replaceInput, 'keydown', onNavKey);

  // Only the search definition restarts the cycle — not the replacement text.
  listen(findInput, 'input', startSearchCycle);
  listen(caseInput, 'change', startSearchCycle);
  listen(wordInput, 'change', startSearchCycle);

  listen(findBtn, 'click', restartSearch);
  listen(findNextBtn, 'click', findNext);
  listen(replaceBtn, 'click', replaceCurrent);
  listen(replaceAllBtn, 'click', replaceAll);
  listen(closeBtn, 'click', destroy);

  listen(
    doc,
    'keydown',
    (event) => {
      if (event.key === 'Escape' && !destroyed) {
        event.preventDefault();
        event.stopPropagation();
        destroy();
      }
    },
    true
  );

  const offDestroy = editor.events.on('destroy', destroy);
  removers.push(() => offDestroy());

  // Pre-seed a cycle when opened with a selection; otherwise wait for input.
  if (selected) startSearchCycle();
  findInput.focus();
  findInput.select();
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
        else openFindReplace(ed);
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

import type { Plugin } from './types';
import type { Editor } from '../editor/Editor';
import { closestTag } from '../dom/DomUtils';
import { icons } from '../ui/icons';

type InlineAction = {
  id: string;
  command: string;
  icon: string;
  label: string;
  queryCommand?: string;
};

const INLINE_ACTIONS: (InlineAction | null)[] = [
  { id: 'bold', command: 'Bold', icon: 'bold', label: 'Bold' },
  { id: 'italic', command: 'Italic', icon: 'italic', label: 'Italic' },
  { id: 'link', command: 'InsertLink', icon: 'link', label: 'Link' },
  null,
  { id: 'h2', command: 'FormatBlock:h2', icon: 'h2', label: 'Heading 2' },
  { id: 'h3', command: 'FormatBlock:h3', icon: 'h3', label: 'Heading 3' },
  {
    id: 'blockquote',
    command: 'FormatBlock:blockquote',
    icon: 'blockquote',
    label: 'Block quote'
  }
];

function selectionAnchorRect(range: Range): DOMRect | null {
  const getClientRects = (range as Range & { getClientRects?: () => DOMRectList }).getClientRects;
  const rects =
    typeof getClientRects === 'function'
      ? Array.from(getClientRects.call(range)).filter((rect) => rect.width || rect.height)
      : [];
  if (rects.length) {
    const first = rects[0]!;
    const last = rects[rects.length - 1]!;
    const left = Math.min(first.left, last.left);
    const right = Math.max(first.right, last.right);
    const top = Math.min(first.top, last.top);
    const bottom = Math.max(first.bottom, last.bottom);
    return new DOMRect(left, top, right - left, bottom - top);
  }
  const getBoundingClientRect = (range as Range & { getBoundingClientRect?: () => DOMRect })
    .getBoundingClientRect;
  if (typeof getBoundingClientRect === 'function') {
    const rect = getBoundingClientRect.call(range);
    if (rect.width || rect.height) return rect;
  }
  return new DOMRect(0, 0, 0, 0);
}

function selectedText(range: Range): string {
  return range
    .toString()
    .replace(/\uFEFF/g, '')
    .trim();
}

function isTextSelection(editor: Editor): Range | null {
  const body = editor.getBody();
  const range = editor.selection.getRange();
  if (!range || range.collapsed) return null;
  if (!body.contains(range.commonAncestorContainer)) return null;
  if (!selectedText(range)) return null;
  if (closestTag(range.commonAncestorContainer, 'table', body)) return null;
  return range;
}

function installInlineTextToolbar(editor: Editor): void {
  const root = editor.getRoot();
  const body = editor.getBody();
  const doc = body.ownerDocument;

  const bar = doc.createElement('div');
  bar.className = 'rly-text-inline-toolbar';
  bar.dataset.testid = 'text-inline-toolbar';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Text formatting');
  bar.addEventListener('mousedown', (e) => e.preventDefault());

  const buttons: { action: InlineAction; el: HTMLButtonElement }[] = [];

  for (const entry of INLINE_ACTIONS) {
    if (entry === null) {
      const sep = doc.createElement('div');
      sep.className = 'rly-text-inline-sep';
      bar.appendChild(sep);
      continue;
    }
    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.tabIndex = -1;
    btn.className = 'rly-text-inline-btn';
    btn.dataset.testid = `inline-text-action-${entry.id}`;
    btn.title = entry.label;
    btn.setAttribute('aria-label', entry.label);
    btn.innerHTML = icons[entry.icon] ?? entry.icon;
    btn.addEventListener('click', () => {
      editor.execCommand(entry.command);
      if (!doc.querySelector('.rly-dialog-overlay')) editor.focus();
    });
    buttons.push({ action: entry, el: btn });
    bar.appendChild(btn);
  }

  root.appendChild(bar);

  let anchor: Range | null = null;

  const refreshActive = (): void => {
    buttons.forEach(({ action, el }) => {
      const queryCommand = action.queryCommand ?? action.command;
      const active = queryCommand ? editor.queryCommandState(queryCommand) : false;
      el.classList.toggle('rly-active', active);
      el.setAttribute('aria-pressed', String(active));
    });
  };

  const hide = (): void => {
    anchor = null;
    bar.classList.remove('rly-open');
  };

  const position = (): void => {
    if (!anchor) {
      hide();
      return;
    }
    const activeRange = isTextSelection(editor);
    if (!activeRange) {
      hide();
      return;
    }
    anchor = activeRange.cloneRange();
    const rect = selectionAnchorRect(activeRange);
    if (!rect) {
      hide();
      return;
    }

    bar.classList.add('rly-open');
    refreshActive();
    const rootRect = root.getBoundingClientRect();
    const bodyRect = body.getBoundingClientRect();
    const barRect = bar.getBoundingClientRect();
    const view = doc.defaultView;

    const left = Math.max(
      8,
      Math.min(
        rootRect.width - barRect.width - 8,
        rect.left - rootRect.left + rect.width / 2 - barRect.width / 2
      )
    );

    const gap = 10;
    const minTopInsideContent = bodyRect.top - rootRect.top + 8;
    const preferredAboveTop = rect.top - rootRect.top - barRect.height - gap;
    const fitsAbove =
      (!view || rect.top - gap - barRect.height - 8 >= 0) &&
      preferredAboveTop >= minTopInsideContent;
    bar.classList.toggle('rly-flip', !fitsAbove);
    const rawTop = fitsAbove ? preferredAboveTop : rect.bottom - rootRect.top + gap;
    const top = Math.max(minTopInsideContent, rawTop);

    bar.style.left = `${left}px`;
    bar.style.top = `${top}px`;
  };

  const show = (): void => {
    const range = isTextSelection(editor);
    if (!range) {
      hide();
      return;
    }
    anchor = range.cloneRange();
    position();
  };

  const onScroll = (): void => position();
  body.addEventListener('scroll', onScroll);
  doc.defaultView?.addEventListener('resize', onScroll);
  editor.events.on('selectionchange', show);
  editor.events.on('change', position);
  editor.events.on('execcommand', position);
  editor.events.on('blur', () => {
    setTimeout(() => {
      if (!root.contains(doc.activeElement)) hide();
    }, 0);
  });
  editor.events.on('destroy', () => {
    body.removeEventListener('scroll', onScroll);
    doc.defaultView?.removeEventListener('resize', onScroll);
    bar.remove();
  });
}

export const textSelectionToolbarPlugin: Plugin = {
  name: 'textselectiontoolbar',
  init(editor) {
    installInlineTextToolbar(editor);
  }
};

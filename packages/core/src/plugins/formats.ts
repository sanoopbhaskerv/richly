import type { Plugin } from './types';
import type { Editor } from '../editor/Editor';
import {
  applyInline,
  removeInline,
  removeAllInline,
  inlineRangesForBlocks,
  combineRanges,
  closestTag,
  closestTagInRange,
  isEmptyElement,
  CARET_FILLER
} from '../dom/DomUtils';

const INLINE_FORMATS: {
  name: string;
  command: string;
  tag: string;
  icon: string;
  tooltip: string;
  shortcut?: string;
}[] = [
  {
    name: 'bold',
    command: 'Bold',
    tag: 'strong',
    icon: 'bold',
    tooltip: 'Bold',
    shortcut: 'Mod+B'
  },
  {
    name: 'italic',
    command: 'Italic',
    tag: 'em',
    icon: 'italic',
    tooltip: 'Italic',
    shortcut: 'Mod+I'
  },
  {
    name: 'underline',
    command: 'Underline',
    tag: 'u',
    icon: 'underline',
    tooltip: 'Underline',
    shortcut: 'Mod+U'
  },
  {
    name: 'strikethrough',
    command: 'Strikethrough',
    tag: 's',
    icon: 'strikethrough',
    tooltip: 'Strikethrough'
  }
];

/**
 * Collapsed cursor: create a "caret container" — an (in)active format element
 * holding a U+FEFF filler — so text typed next is (un)formatted. Same approach
 * as common rich-text editors. getContent() strips the fillers and empty containers.
 */
function toggleInlineCollapsed(editor: Editor, tag: string): void {
  const range = editor.selection.getRange();
  if (!range) return;
  const body = editor.getBody();
  const docRef = body.ownerDocument;
  const ancestor = closestTag(range.startContainer, tag, body);

  const caret = docRef.createTextNode(CARET_FILLER);
  if (!ancestor) {
    // Turn ON: caret goes inside a fresh format element.
    const el = docRef.createElement(tag);
    el.appendChild(caret);
    range.insertNode(el);
  } else {
    // Turn OFF: split the format element at the caret; caret lands between the halves.
    const rightRange = docRef.createRange();
    rightRange.setStart(range.startContainer, range.startOffset);
    rightRange.setEnd(ancestor, ancestor.childNodes.length);
    const rightFrag = rightRange.extractContents();

    const parent = ancestor.parentNode!;
    parent.insertBefore(caret, ancestor.nextSibling);
    if (
      (rightFrag.textContent ?? '').replace(new RegExp(CARET_FILLER, 'g'), '') !== '' ||
      rightFrag.querySelector('img,br')
    ) {
      const rightEl = ancestor.cloneNode(false) as HTMLElement;
      rightEl.appendChild(rightFrag);
      parent.insertBefore(rightEl, caret.nextSibling);
    }
    if (isEmptyElement(ancestor)) ancestor.remove();
  }
  const r = docRef.createRange();
  r.setStart(caret, 1);
  r.collapse(true);
  editor.selection.setRange(r);
  editor.events.emit('change', editor.getContent());
}

function toggleInline(editor: Editor, tag: string): void {
  const range = editor.selection.getRange();
  if (!range) return;
  if (range.collapsed) {
    toggleInlineCollapsed(editor, tag);
    return;
  }
  const body = editor.getBody();
  const subRanges = inlineRangesForBlocks(range, body);

  // Single slice: keep the raw range so parent-boundary selections (e.g.
  // Firefox double-click placing offsets on the parent block) still reach
  // removeInline's ancestor-split path unchanged.
  if (subRanges.length <= 1) {
    const active = !!closestTagInRange(range, tag, body);
    const out = active ? removeInline(range, tag, body) : applyInline(range, tag);
    editor.selection.setRange(out);
    body.normalize();
    editor.events.emit('change', editor.getContent());
    return;
  }

  // Multi-block selection: format each block's slice independently. Wrapping a
  // cross-block fragment in one inline element nests block elements inside an
  // inline tag, corrupting structure (e.g. a stray empty <li>). Each slice
  // stays within its own block, so mutating one never invalidates the others.
  // Toggle off only when every slice is already fully formatted.
  const active = subRanges.every((r) => !!closestTagInRange(r, tag, body));
  const outRanges = subRanges.map((r) =>
    active ? removeInline(r, tag, body) : applyInline(r, tag)
  );
  editor.selection.setRange(combineRanges(outRanges));
  body.normalize();
  editor.events.emit('change', editor.getContent());
}

/**
 * Reports whether the requested inline format covers the current selection.
 *
 * Multi-block selections are represented as block-local ranges because valid
 * HTML cannot use one inline element to wrap several block elements. The format
 * is active only when every selected slice is formatted, matching the toggle
 * behavior and preventing mixed selections from appearing active.
 */
function inlineState(editor: Editor, tag: string): boolean {
  const range = editor.selection.getRange();
  if (!range) return false;
  const body = editor.getBody();
  // Cross-block formatting creates one valid inline element per block. No
  // single <strong>/<em> can therefore own the combined selection. Query each
  // block-local slice using the same all-slices rule that toggleInline uses to
  // decide whether a format should be removed. This also keeps mixed
  // selections inactive until every selected slice carries the format.
  const ranges = range.collapsed ? [range] : inlineRangesForBlocks(range, body);
  return ranges.length > 0 && ranges.every((slice) => !!closestTagInRange(slice, tag, body));
}

export const formatsPlugin: Plugin = {
  name: 'formats',
  init(editor) {
    for (const f of INLINE_FORMATS) {
      editor.commands.register(f.command, {
        execute: (ed) => toggleInline(ed, f.tag),
        queryState: (ed) => inlineState(ed, f.tag)
      });
      editor.ui.addToggleButton(f.name, {
        icon: f.icon,
        tooltip: f.tooltip,
        command: f.command,
        shortcut: f.shortcut
      });
      editor.ui.addMenuItem(f.name, {
        menu: 'format',
        text: f.tooltip,
        command: f.command,
        shortcut: f.shortcut
      });
    }

    editor.commands.register('RemoveFormat', {
      execute: (ed) => {
        const range = ed.selection.getRange();
        if (!range || range.collapsed) return;
        removeAllInline(range, ed.getBody());
        ed.getBody().normalize();
        ed.events.emit('change', ed.getContent());
      }
    });
    editor.ui.addButton('removeformat', {
      icon: 'removeformat',
      tooltip: 'Clear formatting',
      command: 'RemoveFormat'
    });
    editor.ui.addMenuItem('removeformat', {
      menu: 'format',
      text: 'Clear formatting',
      command: 'RemoveFormat'
    });
  }
};

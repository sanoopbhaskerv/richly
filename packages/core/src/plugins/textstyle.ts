import type { Plugin } from './types';
import { getEditorConfig, type Editor } from '../editor/Editor';
import { createColorPickerPanel } from '../ui/colorpicker/ColorPicker';
import { normalizeHex } from '../ui/colorpicker/ColorUtils';
import { createFontSizeControl, type FontSizeCommandArgs } from '../ui/FontSizeControl';
import {
  applyStyledSpan,
  removeStyledSpan,
  queryStyledValue,
  closestTag,
  closestTagInRange,
  removeInline,
  applyInline,
  isStyleSpan,
  CARET_FILLER
} from '../dom/DomUtils';

export const DEFAULT_FONT_SIZES = ['12px', '14px', '16px', '18px', '24px', '32px'];

export const DEFAULT_COLORS = [
  // light / soft
  '#fee2e2',
  '#ffedd5',
  '#fef9c3',
  '#dcfce7',
  '#cffafe',
  '#dbeafe',
  '#f3e8ff',
  '#ffffff',
  // vibrant
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#a855f7',
  '#ec4899',
  // dark / gray
  '#7f1d1d',
  '#9a3412',
  '#854d0e',
  '#14532d',
  '#1e3a8a',
  '#581c87',
  '#52525b',
  '#000000'
];

const COLOR_LABELS: Record<string, string> = {
  '#fee2e2': 'Soft red',
  '#ffedd5': 'Soft orange',
  '#fef9c3': 'Soft yellow',
  '#dcfce7': 'Soft green',
  '#cffafe': 'Soft cyan',
  '#dbeafe': 'Soft blue',
  '#f3e8ff': 'Soft violet',
  '#ffffff': 'White',
  '#ef4444': 'Red',
  '#f97316': 'Orange',
  '#eab308': 'Yellow',
  '#22c55e': 'Green',
  '#06b6d4': 'Cyan',
  '#3b82f6': 'Blue',
  '#a855f7': 'Violet',
  '#ec4899': 'Pink',
  '#7f1d1d': 'Dark red',
  '#9a3412': 'Dark orange',
  '#854d0e': 'Dark yellow',
  '#14532d': 'Dark green',
  '#1e3a8a': 'Dark blue',
  '#581c87': 'Dark violet',
  '#52525b': 'Gray',
  '#000000': 'Black'
};

const colorIdentity = (color: string): string =>
  (normalizeHex(color) ?? color.trim()).toLowerCase();

function prependThemeColors(themeColors: string[], palette: string[]): string[] {
  if (!themeColors.length) return palette;

  const seenThemeColors = new Set<string>();
  const theme = themeColors.flatMap((rawColor) => {
    const color = rawColor.trim();
    if (!color) return [];
    const identity = colorIdentity(color);
    if (seenThemeColors.has(identity)) return [];
    seenThemeColors.add(identity);
    return [color];
  });

  return [...theme, ...palette.filter((color) => !seenThemeColors.has(colorIdentity(color)))];
}

function textStyleOptions(editor: Editor): { colors: string[]; fontSizes: string[] } {
  const cfg = getEditorConfig(editor).textStyles;
  return {
    colors: prependThemeColors(cfg?.themeColors ?? [], cfg?.colors ?? DEFAULT_COLORS),
    fontSizes: cfg?.fontSizes ?? DEFAULT_FONT_SIZES
  };
}

function createColorPanel(
  editor: Editor,
  command: 'ForeColor' | 'BackColor',
  close: () => void
): HTMLElement {
  return createColorPickerPanel({
    mode: command === 'ForeColor' ? 'text' : 'highlight',
    editor,
    close,
    palette: textStyleOptions(editor).colors.map((color) => ({
      value: color,
      label: COLOR_LABELS[(normalizeHex(color) ?? color).toLowerCase()] ?? `Color ${color}`
    })),
    getCurrentColor: () => editor.queryCommandValue(command),
    onApply: (color) => editor.execCommand(command, color ?? '')
  });
}

/**
 * Handle collapsed styling selections by wrapping the caret (U+FEFF filler) inside a styling span,
 * or by modifying an existing collapsed styled span.
 */
function toggleStyleCollapsed(editor: Editor, prop: string, value: string): void {
  const range = editor.selection.getRange();
  if (!range) return;
  const body = editor.getBody();
  const docRef = body.ownerDocument;

  const container = range.startContainer;
  const parent = container.parentNode as HTMLElement;

  // Optimize: If we are already inside a collapsed styling caret container span,
  // we can modify or remove the property directly on it.
  if (
    container.nodeType === Node.TEXT_NODE &&
    container.textContent === CARET_FILLER &&
    parent &&
    parent !== body &&
    isStyleSpan(parent)
  ) {
    if (value) {
      parent.style.setProperty(prop, value);
    } else {
      parent.style.removeProperty(prop);
      // If the style span has no other styles left, unwrap it to clean DOM.
      if (!parent.style.cssText.trim()) {
        const textNode = docRef.createTextNode(CARET_FILLER);
        parent.parentNode?.replaceChild(textNode, parent);
        const r = docRef.createRange();
        r.setStart(textNode, 1);
        r.collapse(true);
        editor.selection.setRange(r);
      }
    }
    editor.events.emit('change', editor.getContent());
    return;
  }

  // Split an existing pure style span so replacing one property never creates
  // nested spans and all other properties remain active for newly typed text.
  const nearestSpan = closestTag(range.startContainer, 'span', body);
  const ancestor = nearestSpan && isStyleSpan(nearestSpan) ? nearestSpan : null;
  if (!value && !ancestor?.style.getPropertyValue(prop)) return;

  const caret = docRef.createTextNode(CARET_FILLER);
  if (ancestor) {
    const current = ancestor.style.getPropertyValue(prop).trim();
    const probe = docRef.createElement('span');
    probe.style.setProperty(prop, value);
    if (value && current === probe.style.getPropertyValue(prop).trim()) return;

    const rightRange = docRef.createRange();
    rightRange.setStart(range.startContainer, range.startOffset);
    rightRange.setEnd(ancestor, ancestor.childNodes.length);
    const rightFrag = rightRange.extractContents();
    const parentNode = ancestor.parentNode!;

    const middle = ancestor.cloneNode(false) as HTMLElement;
    if (value) middle.style.setProperty(prop, value);
    else middle.style.removeProperty(prop);
    const middleNode: Node = middle.style.cssText.trim() ? middle : caret;
    if (middleNode === middle) middle.appendChild(caret);
    parentNode.insertBefore(middleNode, ancestor.nextSibling);

    if (
      (rightFrag.textContent ?? '').replace(new RegExp(CARET_FILLER, 'g'), '') !== '' ||
      rightFrag.querySelector('img,br')
    ) {
      const rightEl = ancestor.cloneNode(false) as HTMLElement;
      rightEl.appendChild(rightFrag);
      parentNode.insertBefore(rightEl, middleNode.nextSibling);
    }
    if (
      (ancestor.textContent ?? '').replace(new RegExp(CARET_FILLER, 'g'), '') === '' &&
      !ancestor.querySelector('img,br')
    ) {
      ancestor.remove();
    }
  } else {
    const span = docRef.createElement('span');
    span.style.setProperty(prop, value);
    span.appendChild(caret);
    range.insertNode(span);
  }

  const r = docRef.createRange();
  r.setStart(caret, 1);
  r.collapse(true);
  editor.selection.setRange(r);
  editor.events.emit('change', editor.getContent());
}

function queryStyleCommandValue(editor: Editor, prop: string): string {
  const range = editor.selection.getRange();
  if (!range) return '';
  let probe: Node = range.startContainer;
  if (!range.collapsed) {
    const doc = editor.getBody().ownerDocument;
    const showText = doc.defaultView?.NodeFilter.SHOW_TEXT ?? 4;
    const rangeType = doc.defaultView?.Range ?? Range;
    const walker = doc.createTreeWalker(editor.getBody(), showText);
    let textNode = walker.nextNode();
    while (textNode) {
      if (textNode.textContent) {
        const nodeRange = doc.createRange();
        nodeRange.selectNodeContents(textNode);
        const overlaps =
          range.compareBoundaryPoints(rangeType.START_TO_END, nodeRange) > 0 &&
          range.compareBoundaryPoints(rangeType.END_TO_START, nodeRange) < 0;
        if (overlaps) {
          probe = textNode;
          break;
        }
      }
      textNode = walker.nextNode();
    }
  }
  return queryStyledValue(probe, prop, editor.getBody());
}

/**
 * Applies or removes an inline style property to/from the selection.
 */
function toggleStyle(editor: Editor, prop: string, value: string): void {
  const range = editor.selection.getRange();
  if (!range) return;

  if (range.collapsed) {
    toggleStyleCollapsed(editor, prop, value);
    return;
  }

  const body = editor.getBody();
  const out = value
    ? applyStyledSpan(range, prop, value, body)
    : removeStyledSpan(range, prop, body);

  editor.selection.setRange(out);
  body.querySelectorAll('span').forEach((span) => {
    if (
      isStyleSpan(span) &&
      !(span.textContent ?? '').replace(new RegExp(CARET_FILLER, 'g'), '') &&
      !span.querySelector('img,br')
    ) {
      span.remove();
    }
  });
  body.normalize();
  editor.events.emit('change', editor.getContent());
}

/**
 * Handle superscript/subscript mutual exclusion and formatting toggles.
 */
function toggleTag(editor: Editor, tag: string, excludeTag: string): void {
  const range = editor.selection.getRange();
  if (!range) return;

  const body = editor.getBody();

  // 1. Remove the opposing exclusive tag first
  if (range.collapsed) {
    const excludeAncestor = closestTag(range.startContainer, excludeTag, body);
    if (excludeAncestor) {
      const docRef = body.ownerDocument;
      const caret = docRef.createTextNode(CARET_FILLER);

      const rightRange = docRef.createRange();
      rightRange.setStart(range.startContainer, range.startOffset);
      rightRange.setEnd(excludeAncestor, excludeAncestor.childNodes.length);
      const rightFrag = rightRange.extractContents();

      const parent = excludeAncestor.parentNode!;
      parent.insertBefore(caret, excludeAncestor.nextSibling);
      if (
        (rightFrag.textContent ?? '').replace(new RegExp(CARET_FILLER, 'g'), '') !== '' ||
        rightFrag.querySelector('img,br')
      ) {
        const rightEl = excludeAncestor.cloneNode(false) as HTMLElement;
        rightEl.appendChild(rightFrag);
        parent.insertBefore(rightEl, caret.nextSibling);
      }
      if (
        (excludeAncestor.textContent ?? '').replace(new RegExp(CARET_FILLER, 'g'), '') === '' &&
        !excludeAncestor.querySelector('img,br')
      ) {
        excludeAncestor.remove();
      }
      const r = docRef.createRange();
      r.setStart(caret, 1);
      r.collapse(true);
      editor.selection.setRange(r);
    }
  } else {
    const cleanedRange = removeInline(range, excludeTag, body);
    editor.selection.setRange(cleanedRange);
  }

  // 2. Toggle the requested tag
  const freshRange = editor.selection.getRange()!;
  if (freshRange.collapsed) {
    const ancestor = closestTag(freshRange.startContainer, tag, body);
    const docRef = body.ownerDocument;
    const caret = docRef.createTextNode(CARET_FILLER);
    if (!ancestor) {
      const el = docRef.createElement(tag);
      el.appendChild(caret);
      freshRange.insertNode(el);
    } else {
      const rightRange = docRef.createRange();
      rightRange.setStart(freshRange.startContainer, freshRange.startOffset);
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
      if (
        (ancestor.textContent ?? '').replace(new RegExp(CARET_FILLER, 'g'), '') === '' &&
        !ancestor.querySelector('img,br')
      ) {
        ancestor.remove();
      }
    }
    const r = docRef.createRange();
    r.setStart(caret, 1);
    r.collapse(true);
    editor.selection.setRange(r);
  } else {
    const active = !!closestTagInRange(freshRange, tag, body);
    const out = active ? removeInline(freshRange, tag, body) : applyInline(freshRange, tag);
    editor.selection.setRange(out);
    body.normalize();
  }
  editor.events.emit('change', editor.getContent());
}

export const textStylePlugin: Plugin = {
  name: 'textstyle',
  init(editor) {
    // ForeColor Command
    editor.commands.register('ForeColor', {
      execute: (ed, args) => {
        const color = typeof args === 'string' ? args : '';
        toggleStyle(ed, 'color', color);
      },
      queryState: (ed) => {
        return !!queryStyleCommandValue(ed, 'color');
      },
      queryValue: (ed) => queryStyleCommandValue(ed, 'color')
    });

    // BackColor Command
    editor.commands.register('BackColor', {
      execute: (ed, args) => {
        const color = typeof args === 'string' ? args : '';
        toggleStyle(ed, 'background-color', color);
      },
      queryState: (ed) => {
        return !!queryStyleCommandValue(ed, 'background-color');
      },
      queryValue: (ed) => queryStyleCommandValue(ed, 'background-color')
    });

    // FontSize Command
    editor.commands.register('FontSize', {
      execute: (ed, args) => {
        const size = (args as FontSizeCommandArgs | undefined)?.value ?? null;
        toggleStyle(ed, 'font-size', size ?? '');
      },
      queryState: (ed) => {
        return !!queryStyleCommandValue(ed, 'font-size');
      },
      queryValue: (ed) => queryStyleCommandValue(ed, 'font-size')
    });

    // Superscript Command
    editor.commands.register('Superscript', {
      execute: (ed) => {
        toggleTag(ed, 'sup', 'sub');
      },
      queryState: (ed) => {
        const range = ed.selection.getRange();
        if (!range) return false;
        return !!closestTagInRange(range, 'sup', ed.getBody());
      },
      queryValue: () => ''
    });

    // Subscript Command
    editor.commands.register('Subscript', {
      execute: (ed) => {
        toggleTag(ed, 'sub', 'sup');
      },
      queryState: (ed) => {
        const range = ed.selection.getRange();
        if (!range) return false;
        return !!closestTagInRange(range, 'sub', ed.getBody());
      },
      queryValue: () => ''
    });

    editor.ui.addButton('forecolor', {
      type: 'panel',
      icon: 'forecolor',
      tooltip: 'Text color',
      valueCommand: 'ForeColor',
      panel: (ed, close) => createColorPanel(ed, 'ForeColor', close)
    });
    editor.ui.addButton('backcolor', {
      type: 'panel',
      icon: 'backcolor',
      tooltip: 'Background color',
      valueCommand: 'BackColor',
      panel: (ed, close) => createColorPanel(ed, 'BackColor', close)
    });

    editor.ui.addButton('fontsize', {
      type: 'component',
      render: (ed) => createFontSizeControl({ editor: ed }).element
    });

    editor.ui.addToggleButton('superscript', {
      icon: 'superscript',
      tooltip: 'Superscript',
      command: 'Superscript'
    });
    editor.ui.addToggleButton('subscript', {
      icon: 'subscript',
      tooltip: 'Subscript',
      command: 'Subscript'
    });

    editor.ui.addMenuItem('superscript', {
      menu: 'format',
      text: 'Superscript',
      command: 'Superscript'
    });
    editor.ui.addMenuItem('subscript', {
      menu: 'format',
      text: 'Subscript',
      command: 'Subscript'
    });
    textStyleOptions(editor).fontSizes.forEach((size) => {
      editor.ui.addMenuItem(`fontsize-${size.replace(/[^a-z0-9]+/gi, '-')}`, {
        menu: 'format',
        text: `Font size ${size}`,
        command: 'FontSize',
        args: { value: size } satisfies FontSizeCommandArgs
      });
    });
  }
};

import type { Editor } from '../editor/Editor';
import {
  applyStyledSpan,
  CARET_FILLER,
  closestTag,
  isStyleSpan,
  queryStyledValue,
  removeStyledSpan
} from './DomUtils';

/**
 * Apply or remove one CSS property on the editor's current selection.
 *
 * This is the public plugin-safe path used by Richly's text color, highlight,
 * and font-size commands. Non-collapsed structural selections are clipped to
 * individual leaf blocks before spans are created, so selecting list items can
 * never produce invalid wrappers such as `<span><li>…</li></span>`. Collapsed
 * selections create or update a caret style that applies to subsequently typed
 * text. Passing an empty value removes only the requested property.
 *
 * Plugin authors should use a CSS property allowed by Richly's sanitizer;
 * unsupported properties can exist in the live DOM but are omitted by
 * `editor.getContent()`.
 *
 * @param editor - Editor whose current selection should be styled.
 * @param property - CSS property name, for example `background-color`.
 * @param value - CSS value to apply, or an empty string to remove the property.
 * @returns `true` when a selection was available and the command was handled.
 */
export function applyInlineStyle(editor: Editor, property: string, value: string): boolean {
  const range = editor.selection.getRange();
  if (!range) return false;

  if (range.collapsed) {
    applyCollapsedInlineStyle(editor, property, value);
    return true;
  }

  const body = editor.getBody();
  const updatedRange = value
    ? applyStyledSpan(range, property, value, body)
    : removeStyledSpan(range, property, body);

  editor.selection.setRange(updatedRange);
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
  return true;
}

/**
 * Read the inline value at the first textual position in the current
 * selection. This matches Richly's command-state behavior for color and font
 * size controls and is intended for custom plugin `queryState`/`queryValue`
 * implementations.
 *
 * @param editor - Editor whose selection should be queried.
 * @param property - CSS property name to inspect.
 * @returns The nearest inline value, or an empty string when none is active.
 */
export function getInlineStyleValue(editor: Editor, property: string): string {
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
  return queryStyledValue(probe, property, editor.getBody());
}

/** Keep collapsed styles active for future typing without nesting spans. */
function applyCollapsedInlineStyle(editor: Editor, property: string, value: string): void {
  const range = editor.selection.getRange();
  if (!range) return;
  const body = editor.getBody();
  const doc = body.ownerDocument;
  const container = range.startContainer;
  const parent = container.parentNode as HTMLElement;

  if (
    container.nodeType === Node.TEXT_NODE &&
    container.textContent === CARET_FILLER &&
    parent &&
    parent !== body &&
    isStyleSpan(parent)
  ) {
    if (value) {
      parent.style.setProperty(property, value);
    } else {
      parent.style.removeProperty(property);
      if (!parent.style.cssText.trim()) {
        const textNode = doc.createTextNode(CARET_FILLER);
        parent.parentNode?.replaceChild(textNode, parent);
        const next = doc.createRange();
        next.setStart(textNode, 1);
        next.collapse(true);
        editor.selection.setRange(next);
      }
    }
    editor.events.emit('change', editor.getContent());
    return;
  }

  // Split an existing pure style span so replacing one property preserves all
  // other styles on the text to either side of the caret.
  const nearestSpan = closestTag(range.startContainer, 'span', body);
  const ancestor = nearestSpan && isStyleSpan(nearestSpan) ? nearestSpan : null;
  if (!value && !ancestor?.style.getPropertyValue(property)) return;

  const caret = doc.createTextNode(CARET_FILLER);
  if (ancestor) {
    const current = ancestor.style.getPropertyValue(property).trim();
    const probe = doc.createElement('span');
    probe.style.setProperty(property, value);
    if (value && current === probe.style.getPropertyValue(property).trim()) return;

    const rightRange = doc.createRange();
    rightRange.setStart(range.startContainer, range.startOffset);
    rightRange.setEnd(ancestor, ancestor.childNodes.length);
    const rightFragment = rightRange.extractContents();
    const parentNode = ancestor.parentNode!;

    const middle = ancestor.cloneNode(false) as HTMLElement;
    if (value) middle.style.setProperty(property, value);
    else middle.style.removeProperty(property);
    const middleNode: Node = middle.style.cssText.trim() ? middle : caret;
    if (middleNode === middle) middle.appendChild(caret);
    parentNode.insertBefore(middleNode, ancestor.nextSibling);

    if (
      (rightFragment.textContent ?? '').replace(new RegExp(CARET_FILLER, 'g'), '') !== '' ||
      rightFragment.querySelector('img,br')
    ) {
      const right = ancestor.cloneNode(false) as HTMLElement;
      right.appendChild(rightFragment);
      parentNode.insertBefore(right, middleNode.nextSibling);
    }
    if (
      (ancestor.textContent ?? '').replace(new RegExp(CARET_FILLER, 'g'), '') === '' &&
      !ancestor.querySelector('img,br')
    ) {
      ancestor.remove();
    }
  } else {
    const span = doc.createElement('span');
    span.style.setProperty(property, value);
    span.appendChild(caret);
    range.insertNode(span);
  }

  const next = doc.createRange();
  next.setStart(caret, 1);
  next.collapse(true);
  editor.selection.setRange(next);
  editor.events.emit('change', editor.getContent());
}

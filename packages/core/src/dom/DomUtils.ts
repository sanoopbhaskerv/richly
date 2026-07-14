/** DOM mutation helpers for the command layer. NO document.execCommand anywhere. */

export const TAG_ALIASES: Record<string, string[]> = {
  strong: ['strong', 'b'],
  em: ['em', 'i'],
  u: ['u'],
  s: ['s', 'strike', 'del'],
  code: ['code'],
  sub: ['sub'],
  sup: ['sup']
};

export const BLOCK_TAGS = [
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'pre',
  'div',
  'li'
];

const INLINE_FORMAT_TAGS = Object.values(TAG_ALIASES).flat().concat(['span', 'font']);

function aliasesFor(tag: string): string[] {
  return TAG_ALIASES[tag] ?? [tag];
}

/** Closest ancestor (within root) matching tag or its aliases. */
export function closestTag(node: Node | null, tag: string, root: HTMLElement): HTMLElement | null {
  const names = aliasesFor(tag).map((t) => t.toUpperCase());
  let n: Node | null = node;
  while (n && n !== root) {
    if (n.nodeType === Node.ELEMENT_NODE && names.includes((n as HTMLElement).tagName)) {
      return n as HTMLElement;
    }
    n = n.parentNode;
  }
  return null;
}

/**
 * Resolve an inline element represented by a selection. Firefox may place a
 * double-click range on the parent element boundaries (for example, P offsets
 * immediately before/after STRONG) instead of inside the inline text node.
 */
export function closestTagInRange(
  range: Range,
  tag: string,
  root: HTMLElement
): HTMLElement | null {
  const direct =
    closestTag(range.startContainer, tag, root) ??
    closestTag(range.endContainer, tag, root) ??
    closestTag(range.commonAncestorContainer, tag, root);
  if (direct || range.collapsed) return direct;

  const selector = aliasesFor(tag).join(',');
  const selectedText = range.toString().replace(/\s+/g, ' ').trim();
  const matches = Array.from(root.querySelectorAll<HTMLElement>(selector)).filter((element) => {
    try {
      return (
        range.intersectsNode(element) &&
        selectedText !== '' &&
        element.textContent?.replace(/\s+/g, ' ').trim() === selectedText
      );
    } catch {
      return false;
    }
  });
  return matches.length === 1 ? matches[0]! : null;
}

export function closestBlock(node: Node | null, root: HTMLElement): HTMLElement | null {
  const names = BLOCK_TAGS.map((t) => t.toUpperCase());
  let n: Node | null = node;
  while (n && n !== root) {
    if (n.nodeType === Node.ELEMENT_NODE && names.includes((n as HTMLElement).tagName)) {
      return n as HTMLElement;
    }
    n = n.parentNode;
  }
  return null;
}

/** Remove all elements matching tag (and aliases) inside fragment, keeping children. */
export function stripTagInFragment(frag: DocumentFragment | HTMLElement, tag: string): void {
  const selector = aliasesFor(tag).join(',');
  frag.querySelectorAll(selector).forEach((el) => unwrap(el));
}

export function unwrap(el: Element): void {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}

/** U+FEFF — used as caret container filler for pending formats (see plugins/formats.ts). */
export const CARET_FILLER = '﻿';

export function isEmptyElement(el: Element): boolean {
  return (el.textContent ?? '').replace(/﻿/g, '') === '' && !el.querySelector('img,br,hr,table');
}
const isEmpty = isEmptyElement;

/** Leaf block elements intersecting the range (for multi-block commands like align/lists). */
export function blocksInRange(range: Range, root: HTMLElement): HTMLElement[] {
  const all = Array.from(root.querySelectorAll<HTMLElement>(BLOCK_TAGS.join(',')));
  const hits = all.filter((b) => {
    try {
      return range.intersectsNode(b);
    } catch {
      return false;
    }
  });
  const leaves = hits.filter((b) => !hits.some((other) => other !== b && b.contains(other)));
  if (leaves.length) return leaves;
  const b = closestBlock(range.startContainer, root);
  return b ? [b] : [];
}

/** Wrap the range contents in `tag`. De-dupes nested same-tags. Selects the result. */
export function applyInline(range: Range, tag: string): Range {
  const doc = range.startContainer.ownerDocument!;
  const frag = range.extractContents();
  stripTagInFragment(frag, tag); // avoid <strong><strong>
  const el = doc.createElement(tag);
  el.appendChild(frag);
  range.insertNode(el);
  const out = doc.createRange();
  out.selectNodeContents(el);
  return out;
}

/**
 * Remove `tag` formatting from range contents. Handles the split case:
 * un-bolding the middle of a larger bold run splits the ancestor.
 */
export function removeInline(range: Range, tag: string, root: HTMLElement): Range {
  const doc = range.startContainer.ownerDocument!;
  const ancestor =
    closestTagInRange(range, tag, root) ?? closestTag(range.startContainer, tag, root);

  // A browser may represent an exact element selection with boundaries in the
  // parent. In that case the ancestor-splitting algorithm cannot use those
  // boundary points inside the element; strip the extracted fragment instead.
  if (
    ancestor &&
    (!ancestor.contains(range.startContainer) || !ancestor.contains(range.endContainer))
  ) {
    const frag = range.extractContents();
    stripTagInFragment(frag, tag);
    const first = frag.firstChild;
    const last = frag.lastChild;
    range.insertNode(frag);
    const out = doc.createRange();
    if (first && last) {
      out.setStartBefore(first);
      out.setEndAfter(last);
    }
    return out;
  }

  if (ancestor) {
    // Split: [left stays in ancestor][mid = unformatted][right = clone of ancestor]
    const rightRange = doc.createRange();
    rightRange.setStart(range.endContainer, range.endOffset);
    rightRange.setEnd(ancestor, ancestor.childNodes.length);
    const rightFrag = rightRange.extractContents();

    const midFrag = range.extractContents();
    stripTagInFragment(midFrag, tag);

    const parent = ancestor.parentNode!;
    const next = ancestor.nextSibling;

    let rightEl: HTMLElement | null = null;
    if (rightFrag.textContent !== '' || rightFrag.querySelector('img,br')) {
      rightEl = ancestor.cloneNode(false) as HTMLElement;
      rightEl.appendChild(rightFrag);
    }

    const marker = doc.createTextNode('');
    parent.insertBefore(marker, next);
    if (rightEl) parent.insertBefore(rightEl, marker);

    const anchorNode: Node = rightEl ?? marker;
    const midStart = Array.prototype.indexOf.call(parent.childNodes, anchorNode);
    parent.insertBefore(midFrag, anchorNode);

    if (isEmpty(ancestor)) parent.removeChild(ancestor);

    const out = doc.createRange();
    const midEnd = Array.prototype.indexOf.call(parent.childNodes, anchorNode);
    out.setStart(parent, Math.max(0, isEmpty(ancestor) ? midStart - 1 : midStart));
    out.setEnd(parent, midEnd);
    marker.remove();
    return out;
  }

  // No wrapping ancestor: just strip matching tags inside the selection.
  const frag = range.extractContents();
  stripTagInFragment(frag, tag);
  const first = frag.firstChild;
  const last = frag.lastChild;
  range.insertNode(frag);
  const out = doc.createRange();
  if (first && last) {
    out.setStartBefore(first);
    out.setEndAfter(last);
  }
  return out;
}

/** Replace the closest block of `node` with a new element of `tag`, moving children. */
export function transformBlock(node: Node, tag: string, root: HTMLElement): HTMLElement | null {
  const doc = root.ownerDocument;
  let block = closestBlock(node, root);
  if (!block) {
    // Bare text directly under root — wrap it first.
    const p = doc.createElement('p');
    let n: Node | null = node;
    while (n && n.parentNode !== root) n = n.parentNode;
    if (!n) return null;
    root.insertBefore(p, n);
    p.appendChild(n);
    block = p;
  }
  if (block.tagName.toLowerCase() === tag) return block;
  const el = doc.createElement(tag);
  while (block.firstChild) el.appendChild(block.firstChild);
  block.parentNode!.replaceChild(el, block);
  return el;
}

/** Strip ALL inline formatting inside the range (RemoveFormat). */
export function removeAllInline(range: Range, root: HTMLElement): Range {
  let r = range;
  // Peel formatting ancestors one at a time — removeInline splits them properly
  // so text outside the selection keeps its formatting.
  for (let guard = 0; guard < 20; guard++) {
    const tag = Object.keys(TAG_ALIASES).find(
      (t) => closestTag(r.startContainer, t, root) ?? closestTag(r.commonAncestorContainer, t, root)
    );
    if (!tag) break;
    r = removeInline(r, tag, root);
  }
  // Then strip any formatting tags fully inside the selection.
  const frag = r.extractContents();
  frag.querySelectorAll(INLINE_FORMAT_TAGS.join(',')).forEach((el) => unwrap(el));
  const first = frag.firstChild;
  const last = frag.lastChild;
  r.insertNode(frag);
  if (first && last) {
    r.setStartBefore(first);
    r.setEndAfter(last);
  }
  return r;
}

/**
 * Checks if the given element is a `<span>` whose only purpose/significance is inline styling.
 * An element qualifies if it is a SPAN tag and has no other attributes other than `style`.
 *
 * @param el - The HTML element to check.
 * @returns `true` if the element is a styling-only span; otherwise, `false`.
 */
export function isStyleSpan(el: Element): boolean {
  if (el.tagName.toUpperCase() !== 'SPAN') return false;

  // Iterate through all attributes to check if any attribute other than 'style' is present.
  for (let i = 0; i < el.attributes.length; i++) {
    // Under noUncheckedIndexedAccess, index-based access on el.attributes may return undefined.
    const attrNode = el.attributes[i];
    if (attrNode) {
      const attr = attrNode.name;
      // If there is any attribute other than 'style', it's not a pure style span (e.g. has an ID or class)
      if (attr !== 'style') return false;
    }
  }
  return true;
}

/**
 * Traverses up the DOM tree from the starting node to find the nearest inline-style value
 * for a specific property (e.g., 'color', 'background-color').
 *
 * @param node - The starting DOM node.
 * @param prop - The CSS property name to query.
 * @param root - The editor root container to bound the search traversal.
 * @returns The trimmed inline-style value if found, or an empty string `''` if none.
 */
export function queryStyledValue(node: Node | null, prop: string, root: HTMLElement): string {
  let n: Node | null = node;
  while (n && n !== root) {
    if (n.nodeType === Node.ELEMENT_NODE) {
      const el = n as HTMLElement;
      const val = el.style.getPropertyValue(prop);
      if (val) return val.trim();
    }
    n = n.parentNode;
  }
  return '';
}

/**
 * Finds the closest style span ancestor that has the specified style property set.
 *
 * @param node - The starting DOM node.
 * @param prop - The CSS property name to check on the spans.
 * @param root - The editor root container to bound the search traversal.
 * @returns The closest HTMLElement span ancestor if found, or `null` if none.
 */
export function closestStyledSpanAncestor(
  node: Node | null,
  prop: string,
  root: HTMLElement
): HTMLElement | null {
  let n: Node | null = node;
  while (n && n !== root) {
    if (n.nodeType === Node.ELEMENT_NODE && (n as HTMLElement).tagName.toUpperCase() === 'SPAN') {
      const el = n as HTMLElement;
      if (el.style.getPropertyValue(prop)) return el;
    }
    n = n.parentNode;
  }
  return null;
}

/**
 * Removes the specified style property from the given range.
 * If the style is set on an ancestor span, the span is split around the range
 * so only the text within the selection has the style removed.
 * Structural and cross-block selections use the same block-local normalization
 * as style application, preserving list and block structure while unwrapping.
 *
 * @param range - The document range from which to remove the style.
 * @param prop - The CSS style property to remove (e.g., 'color', 'background-color').
 * @param root - The editor root container to bound the DOM traversal.
 * @returns A connected range selecting the content from which the style was removed.
 */
export function removeStyledSpan(range: Range, prop: string, root: HTMLElement): Range {
  const doc = range.startContainer.ownerDocument!;
  const inlineRanges = inlineRangesForBlocks(range, root);
  if (shouldUseInlineRanges(range, inlineRanges)) {
    const cleanedRanges = new Array<Range>(inlineRanges.length);
    // Work backwards for the same reason as application: extracting or
    // unwrapping a later block must not disturb an earlier saved boundary.
    for (let index = inlineRanges.length - 1; index >= 0; index--) {
      cleanedRanges[index] = removeStyledSpan(inlineRanges[index]!, prop, root);
    }
    return combineRanges(cleanedRanges);
  }

  const ancestor =
    closestStyledSpanAncestor(range.commonAncestorContainer, prop, root) ??
    closestStyledSpanAncestor(range.startContainer, prop, root);

  if (ancestor) {
    // Split: [left stays in ancestor][mid = unformatted][right = clone of ancestor]
    const rightRange = doc.createRange();
    rightRange.setStart(range.endContainer, range.endOffset);
    rightRange.setEnd(ancestor, ancestor.childNodes.length);
    const rightFrag = rightRange.extractContents();

    const midFrag = range.extractContents();

    midFrag.querySelectorAll('span').forEach((el) => {
      const htmlEl = el as HTMLElement;
      if (htmlEl.style.getPropertyValue(prop)) {
        htmlEl.style.removeProperty(prop);
        if (!htmlEl.style.cssText.trim() && isStyleSpan(htmlEl)) {
          unwrap(htmlEl);
        }
      }
    });
    mergeAdjacentStyleChildren(midFrag);

    const parent = ancestor.parentNode!;
    const next = ancestor.nextSibling;

    let rightEl: HTMLElement | null = null;
    if (rightFrag.textContent !== '' || rightFrag.querySelector('img,br')) {
      rightEl = ancestor.cloneNode(false) as HTMLElement;
      rightEl.appendChild(rightFrag);
    }

    const marker = doc.createTextNode('');
    parent.insertBefore(marker, next);
    if (rightEl) parent.insertBefore(rightEl, marker);

    // Mid part gets ancestor's other styles (to preserve them)
    const otherStyles: Record<string, string> = {};
    for (let i = 0; i < ancestor.style.length; i++) {
      // Under noUncheckedIndexedAccess, accessing style[i] might yield undefined.
      const p = ancestor.style[i];
      // Keep styling properties that are not the one currently being removed/split.
      if (p && p !== prop) {
        otherStyles[p] = ancestor.style.getPropertyValue(p);
      }
    }

    let midNode: Node = midFrag;
    if (Object.keys(otherStyles).length > 0) {
      const midSpan = doc.createElement('span');
      Object.entries(otherStyles).forEach(([p, val]) => {
        midSpan.style.setProperty(p, val);
      });
      midSpan.appendChild(midFrag);
      midNode = midSpan;
    }

    const anchorNode: Node = rightEl ?? marker;
    const midStart = Array.prototype.indexOf.call(parent.childNodes, anchorNode);
    parent.insertBefore(midNode, anchorNode);

    // Left side: original ancestor remains (empty elements will be cleaned below)
    if (isEmpty(ancestor)) {
      parent.removeChild(ancestor);
    }

    const out = doc.createRange();
    const midEnd = Array.prototype.indexOf.call(parent.childNodes, anchorNode);
    out.setStart(parent, Math.max(0, isEmpty(ancestor) ? midStart - 1 : midStart));
    out.setEnd(parent, midEnd);
    marker.remove();
    return out;
  }

  const frag = range.extractContents();
  frag.querySelectorAll('span').forEach((el) => {
    const htmlEl = el as HTMLElement;
    if (htmlEl.style.getPropertyValue(prop)) {
      htmlEl.style.removeProperty(prop);
      if (!htmlEl.style.cssText.trim() && isStyleSpan(htmlEl)) {
        unwrap(htmlEl);
      }
    }
  });
  mergeAdjacentStyleChildren(frag);
  const first = frag.firstChild;
  const last = frag.lastChild;
  range.insertNode(frag);
  const out = doc.createRange();
  if (first && last) {
    out.setStartBefore(first);
    out.setEndAfter(last);
  }
  return out;
}

/**
 * Returns a sorted, normalized string representation of an element's inline style rules.
 * Sorting the style rules (e.g., `"color: red; font-size: 14px"`) ensures that comparisons
 * between style definitions are position-independent.
 *
 * @param el - The HTML element whose styles should be normalized.
 * @returns A normalized inline style string.
 */
function getNormalizedStyleText(el: HTMLElement): string {
  const styles: string[] = [];
  for (let i = 0; i < el.style.length; i++) {
    // Under noUncheckedIndexedAccess, accessing style[i] might yield undefined.
    const p = el.style[i];
    if (p) {
      styles.push(`${p}: ${el.style.getPropertyValue(p).trim()}`);
    }
  }
  styles.sort(); // Sort so that property order does not affect style equality comparisons.
  return styles.join('; ');
}

function adjacentMeaningfulSibling(
  el: HTMLElement,
  direction: 'previous' | 'next'
): ChildNode | null {
  let sibling = direction === 'previous' ? el.previousSibling : el.nextSibling;
  while (sibling?.nodeType === Node.TEXT_NODE && sibling.textContent === '') {
    const empty = sibling;
    sibling = direction === 'previous' ? sibling.previousSibling : sibling.nextSibling;
    empty.remove();
  }
  return sibling;
}

function mergeAdjacentStyleSpans(el: HTMLElement): HTMLElement {
  if (!isStyleSpan(el)) return el;
  const normStyle = getNormalizedStyleText(el);

  // Check previous sibling
  const prev = adjacentMeaningfulSibling(el, 'previous');
  if (
    prev &&
    prev.nodeType === Node.ELEMENT_NODE &&
    isStyleSpan(prev as Element) &&
    getNormalizedStyleText(prev as HTMLElement) === normStyle
  ) {
    const prevEl = prev as HTMLElement;
    while (el.firstChild) prevEl.appendChild(el.firstChild);
    el.remove();
    el = prevEl;
  }

  // Check next sibling
  const next = adjacentMeaningfulSibling(el, 'next');
  if (
    next &&
    next.nodeType === Node.ELEMENT_NODE &&
    isStyleSpan(next as Element) &&
    getNormalizedStyleText(next as HTMLElement) === normStyle
  ) {
    const nextEl = next as HTMLElement;
    while (nextEl.firstChild) el.appendChild(nextEl.firstChild);
    nextEl.remove();
  }
  return el;
}

function mergeAdjacentStyleChildren(parent: ParentNode): void {
  let child = parent.firstChild;
  while (child) {
    if (child.nodeType === Node.ELEMENT_NODE && isStyleSpan(child as Element)) {
      const merged = mergeAdjacentStyleSpans(child as HTMLElement);
      child = merged.nextSibling;
    } else {
      child = child.nextSibling;
    }
  }
}

function isAtAbsoluteStart(node: Node, offset: number, ancestor: Node): boolean {
  if (node.nodeType === Node.TEXT_NODE && offset !== 0) return false;
  let curr: Node = node;
  while (curr && curr !== ancestor) {
    const parent = curr.parentNode;
    if (!parent) return false;
    if (parent.firstChild !== curr) return false;
    curr = parent;
  }
  return curr === ancestor;
}

function isAtAbsoluteEnd(node: Node, offset: number, ancestor: Node): boolean {
  if (node.nodeType === Node.TEXT_NODE && offset !== (node.textContent?.length ?? 0)) return false;
  let curr: Node = node;
  while (curr && curr !== ancestor) {
    const parent = curr.parentNode;
    if (!parent) return false;
    if (parent.lastChild !== curr) return false;
    curr = parent;
  }
  return curr === ancestor;
}

/**
 * Convert a browser selection into ranges that are safe for inline wrappers.
 *
 * Native selections are not guaranteed to start and end in text nodes. For
 * example, dragging over the first list item can produce a range from `UL:0`
 * to `LI:0` on the second item. Extracting that range directly includes the
 * first `<li>` and an empty slice of the second. A `<span>` around that
 * fragment is invalid HTML, and browsers repair it by moving or inserting list
 * items.
 *
 * Each returned range is clipped to one leaf block. The strict overlap checks
 * intentionally discard blocks that merely touch the selection boundary, such
 * as the second item in the `LI:0` example above.
 *
 * @param range - Native selection range to normalize.
 * @param root - Editor body that bounds block discovery.
 * @returns Non-collapsed, block-local ranges in document order.
 */
export function inlineRangesForBlocks(range: Range, root: HTMLElement): Range[] {
  if (range.collapsed) return [range];

  const doc = range.startContainer.ownerDocument!;
  const rangeType = doc.defaultView?.Range ?? Range;
  return blocksInRange(range, root).flatMap((block) => {
    const blockRange = doc.createRange();
    blockRange.selectNodeContents(block);
    const overlaps =
      range.compareBoundaryPoints(rangeType.START_TO_END, blockRange) > 0 &&
      range.compareBoundaryPoints(rangeType.END_TO_START, blockRange) < 0;
    if (!overlaps) return [];

    const inlineRange = doc.createRange();
    if (block.contains(range.startContainer)) {
      inlineRange.setStart(range.startContainer, range.startOffset);
    } else {
      inlineRange.setStart(blockRange.startContainer, blockRange.startOffset);
    }
    if (block.contains(range.endContainer)) {
      inlineRange.setEnd(range.endContainer, range.endOffset);
    } else {
      inlineRange.setEnd(blockRange.endContainer, blockRange.endOffset);
    }
    return inlineRange.collapsed ? [] : [inlineRange];
  });
}

/**
 * Restore one visible selection after several block-local mutations.
 *
 * The individual ranges must be supplied in document order and must remain
 * connected after their mutations complete.
 *
 * @param ranges - Updated ranges returned by each block-local operation.
 * @returns A range spanning from the first updated start to the last updated end.
 */
export function combineRanges(ranges: Range[]): Range {
  const first = ranges[0]!;
  const last = ranges[ranges.length - 1]!;
  const out = first.startContainer.ownerDocument!.createRange();
  out.setStart(first.startContainer, first.startOffset);
  out.setEnd(last.endContainer, last.endOffset);
  return out;
}

/**
 * Whether styling must use the clipped ranges instead of the native range.
 *
 * A single clipped range still matters: a structural selection may contain
 * only one non-empty block while its original boundaries include whole block
 * elements. Comparing all four boundary fields prevents that original range
 * from reaching `extractContents()` and creating `<span><li>…</li></span>`.
 *
 * @param range - Original native selection range.
 * @param inlineRanges - Block-local candidates derived from that range.
 * @returns `true` when the operation must recurse over the clipped ranges.
 */
function shouldUseInlineRanges(range: Range, inlineRanges: Range[]): boolean {
  if (inlineRanges.length !== 1) return inlineRanges.length > 1;
  const inlineRange = inlineRanges[0]!;
  return (
    range.startContainer !== inlineRange.startContainer ||
    range.startOffset !== inlineRange.startOffset ||
    range.endContainer !== inlineRange.endContainer ||
    range.endOffset !== inlineRange.endOffset
  );
}

/**
 * Apply an inline CSS property without allowing a styling span to cross a
 * block boundary.
 *
 * Cross-block and structural browser selections are first normalized into
 * block-local ranges. Existing style spans are split, reused, and merged where
 * possible so repeated formatting does not create redundant nesting. Passing
 * an empty value delegates to {@link removeStyledSpan}.
 *
 * @param range - Selection whose textual content should be formatted.
 * @param prop - CSS property name, such as `color` or `background-color`.
 * @param value - CSS property value; an empty value removes the property.
 * @param root - Editor body that bounds ancestor and block traversal.
 * @returns A connected range selecting the formatted content.
 */
export function applyStyledSpan(
  range: Range,
  prop: string,
  value: string,
  root: HTMLElement
): Range {
  const doc = range.startContainer.ownerDocument!;
  if (!value) {
    return removeStyledSpan(range, prop, root);
  }

  const inlineRanges = inlineRangesForBlocks(range, root);
  if (shouldUseInlineRanges(range, inlineRanges)) {
    const styledRanges = new Array<Range>(inlineRanges.length);
    // Work backwards so mutations in a later block cannot invalidate the
    // boundary nodes saved for an earlier block.
    for (let index = inlineRanges.length - 1; index >= 0; index--) {
      styledRanges[index] = applyStyledSpan(inlineRanges[index]!, prop, value, root);
    }
    return combineRanges(styledRanges);
  }

  // Optimize: If the range selects the exact contents of an existing style span ancestor,
  // set the property on it directly without wrapping.
  let parentSpan: HTMLElement | null = null;
  const ancestor = closestTag(range.commonAncestorContainer, 'span', root);
  if (ancestor && isStyleSpan(ancestor)) {
    if (
      isAtAbsoluteStart(range.startContainer, range.startOffset, ancestor) &&
      isAtAbsoluteEnd(range.endContainer, range.endOffset, ancestor)
    ) {
      parentSpan = ancestor;
    }
  }

  if (parentSpan) {
    parentSpan.style.setProperty(prop, value);
    const merged = mergeAdjacentStyleSpans(parentSpan);
    const out = doc.createRange();
    out.selectNodeContents(merged);
    return out;
  }

  const cleanRange = removeStyledSpan(range, prop, root);
  const frag = cleanRange.extractContents();

  let targetEl: HTMLElement;
  if (
    frag.childNodes.length === 1 &&
    frag.firstChild?.nodeType === Node.ELEMENT_NODE &&
    isStyleSpan(frag.firstChild as Element)
  ) {
    targetEl = frag.firstChild as HTMLElement;
    targetEl.style.setProperty(prop, value);
  } else {
    targetEl = doc.createElement('span');
    targetEl.style.setProperty(prop, value);
    targetEl.appendChild(frag);
  }

  cleanRange.insertNode(targetEl);
  targetEl = mergeAdjacentStyleSpans(targetEl);

  const out = doc.createRange();
  out.selectNodeContents(targetEl);
  return out;
}

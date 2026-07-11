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

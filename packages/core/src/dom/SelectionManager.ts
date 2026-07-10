export interface Bookmark {
  start: number[];
  startOffset: number;
  end: number[];
  endOffset: number;
}

/** Normalizes selection access; save/restore across DOM mutations and dialogs. */
export class SelectionManager {
  constructor(private root: HTMLElement) {}

  private get doc(): Document {
    return this.root.ownerDocument;
  }

  /** Current range, only if it lives inside the editable root. */
  getRange(): Range | null {
    const sel = this.doc.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    if (!this.root.contains(range.commonAncestorContainer)) return null;
    return range;
  }

  setRange(range: Range): void {
    const sel = this.doc.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    sel.addRange(range);
  }

  selectNodeContents(node: Node): void {
    const range = this.doc.createRange();
    range.selectNodeContents(node);
    this.setRange(range);
  }

  collapseToEnd(): void {
    this.doc.getSelection()?.collapseToEnd();
  }

  private pathTo(node: Node): number[] {
    const path: number[] = [];
    let n: Node | null = node;
    while (n && n !== this.root) {
      const parent: Node | null = n.parentNode;
      if (!parent) return path; // detached
      path.unshift(Array.prototype.indexOf.call(parent.childNodes, n));
      n = parent;
    }
    return path;
  }

  private nodeAt(path: number[]): Node | null {
    let n: Node = this.root;
    for (const idx of path) {
      const child = n.childNodes[idx];
      if (!child) return null;
      n = child;
    }
    return n;
  }

  getBookmark(): Bookmark | null {
    const range = this.getRange();
    if (!range) return null;
    return {
      start: this.pathTo(range.startContainer),
      startOffset: range.startOffset,
      end: this.pathTo(range.endContainer),
      endOffset: range.endOffset
    };
  }

  moveToBookmark(bm: Bookmark | null): void {
    if (!bm) return;
    const start = this.nodeAt(bm.start);
    const end = this.nodeAt(bm.end);
    if (!start || !end) return;
    const range = this.doc.createRange();
    const clamp = (node: Node, offset: number) =>
      Math.min(offset, node.nodeType === Node.TEXT_NODE ? (node.textContent?.length ?? 0) : node.childNodes.length);
    try {
      range.setStart(start, clamp(start, bm.startOffset));
      range.setEnd(end, clamp(end, bm.endOffset));
      this.setRange(range);
    } catch {
      /* stale bookmark — ignore */
    }
  }
}

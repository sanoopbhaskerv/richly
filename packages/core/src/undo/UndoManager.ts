import type { Editor } from '../editor/Editor';
import type { Bookmark } from '../dom/SelectionManager';

interface Snapshot {
  html: string;
  bookmark: Bookmark | null;
}

/** Snapshot-based undo with typing coalescing (DESIGN.md §2.2). */
export class UndoManager {
  private stack: Snapshot[] = [];
  private index = -1;
  private lastTypedAt = 0;
  readonly coalesceMs = 600;
  readonly maxDepth = 100;

  constructor(private editor: Editor) {}

  private current(): Snapshot {
    return {
      html: this.editor.getBody().innerHTML,
      bookmark: this.editor.selection.getBookmark()
    };
  }

  /** Push initial state after editor init. */
  reset(): void {
    this.stack = [this.current()];
    this.index = 0;
    this.lastTypedAt = 0;
  }

  /** Record state. Called before every command, and (coalesced) on typing. */
  snapshot(coalesce = false): void {
    const snap = this.current();
    // Any new mutation path invalidates the redo tail.
    this.stack.length = this.index + 1;
    const top = this.stack[this.index];
    if (top && top.html === snap.html) {
      this.stack[this.index] = snap; // content unchanged — refresh selection only
      return;
    }
    const now = Date.now();
    if (coalesce && now - this.lastTypedAt < this.coalesceMs && this.index >= 0) {
      this.stack[this.index] = snap; // merge burst of keystrokes into one level
    } else {
      this.stack.push(snap);
      if (this.stack.length > this.maxDepth) this.stack.shift();
      this.index = this.stack.length - 1;
    }
    if (coalesce) this.lastTypedAt = now;
  }

  canUndo(): boolean {
    return this.index > 0;
  }

  canRedo(): boolean {
    return this.index < this.stack.length - 1;
  }

  undo(): void {
    // Commit any uncommitted changes as a level first, so redo can return to them.
    const snap = this.current();
    const cur = this.stack[this.index];
    if (cur && cur.html !== snap.html) this.snapshot(false);
    if (!this.canUndo()) return;
    this.index--;
    this.restore();
  }

  redo(): void {
    if (!this.canRedo()) return;
    this.index++;
    this.restore();
  }

  private restore(): void {
    const snap = this.stack[this.index];
    if (!snap) return;
    this.editor.getBody().innerHTML = snap.html;
    this.editor.selection.moveToBookmark(snap.bookmark);
    this.lastTypedAt = 0;
    this.editor.events.emit('change', this.editor.getContent());
  }
}

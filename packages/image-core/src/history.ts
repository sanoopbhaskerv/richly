import type { HistoryEntrySummary, ImageOperation } from './types';

interface Entry {
  readonly summary: HistoryEntrySummary;
  readonly operations: readonly ImageOperation[];
}

/** Structural-sharing history over immutable operation manifests. */
export class ManifestHistory {
  private entries: Entry[];
  private index = 0;

  constructor(
    baseline: readonly ImageOperation[],
    private readonly now: () => number,
    private readonly createId: () => string
  ) {
    this.entries = [this.entry('Restored baseline', baseline)];
  }

  get current(): readonly ImageOperation[] {
    return this.entries[this.index]?.operations ?? [];
  }

  get summaries(): readonly HistoryEntrySummary[] {
    return this.entries.map((entry) => entry.summary);
  }

  get cursor(): number {
    return this.index;
  }

  get canUndo(): boolean {
    return this.index > 0;
  }

  get canRedo(): boolean {
    return this.index < this.entries.length - 1;
  }

  push(label: string, operations: readonly ImageOperation[]): boolean {
    if (sameManifest(this.current, operations)) return false;
    this.entries = [...this.entries.slice(0, this.index + 1), this.entry(label, operations)];
    this.index = this.entries.length - 1;
    return true;
  }

  undo(): readonly ImageOperation[] | null {
    if (!this.canUndo) return null;
    this.index -= 1;
    return this.current;
  }

  redo(): readonly ImageOperation[] | null {
    if (!this.canRedo) return null;
    this.index += 1;
    return this.current;
  }

  jump(index: number): readonly ImageOperation[] | null {
    if (!Number.isInteger(index) || index < 0 || index >= this.entries.length) return null;
    this.index = index;
    return this.current;
  }

  private entry(label: string, operations: readonly ImageOperation[]): Entry {
    return {
      summary: { id: this.createId(), label, timestamp: this.now() },
      operations
    };
  }
}

/** Compares operation manifests by serialized operation shape. */
export function sameManifest(a: readonly ImageOperation[], b: readonly ImageOperation[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((operation, index) => JSON.stringify(operation) === JSON.stringify(b[index]));
}

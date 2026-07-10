import type { Editor } from '../editor/Editor';

export interface Command {
  execute(editor: Editor, args?: unknown): void;
  /** True when the command's format is active at the cursor (drives toolbar toggle state). */
  queryState?(editor: Editor): boolean;
  /** Skip the automatic undo snapshot (e.g. Undo/Redo themselves). */
  skipUndo?: boolean;
}

export class CommandRegistry {
  private commands = new Map<string, Command>();

  constructor(private editor: Editor) {}

  register(name: string, command: Command): void {
    this.commands.set(name.toLowerCase(), command);
  }

  has(name: string): boolean {
    return this.commands.has(name.toLowerCase());
  }

  execute(name: string, args?: unknown): boolean {
    const cmd = this.commands.get(name.toLowerCase());
    if (!cmd) return false;
    if (!cmd.skipUndo) this.editor.undoManager.snapshot();
    cmd.execute(this.editor, args);
    return true;
  }

  queryState(name: string): boolean {
    return this.commands.get(name.toLowerCase())?.queryState?.(this.editor) ?? false;
  }
}

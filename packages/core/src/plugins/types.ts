import type { Editor } from '../editor/Editor';

/** Every feature — core or user-supplied — implements this. No privileged code paths. */
export interface Plugin {
  name: string;
  init(editor: Editor): void;
}

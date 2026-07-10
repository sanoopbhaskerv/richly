# @sb/editor-react

React bindings for SB Editor.

```tsx
import { Editor } from '@sb/editor-react';
import '@sb/editor-core/theme.css';

export function App() {
  return <Editor initialValue="<p>Hello.</p>" />;
}
```

Toolbar groups wrap by default. Pass `toolbarOverflow` to keep one row and move
extra groups into a More menu.

Use the `wordCount` prop to disable counts or show words, characters, and the
current selection. The React wrapper exposes the same search, preview, visual
blocks, safe paste, and table merge/split features as the core package.

See the repository README for the full API and contributor workflow.

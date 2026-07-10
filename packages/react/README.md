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

See the repository README for the full API and contributor workflow.

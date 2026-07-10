# @richly/core

The framework-free Richly core package.

```ts
import { Editor } from '@richly/core';
import '@richly/core/theme.css';

const editor = Editor.init({ target: document.querySelector('#editor')! });
```

Toolbar groups wrap by default so every action remains visible. Set
`toolbarOverflow: true` to keep the toolbar on one row and place extra groups in
a More menu.

The default plugins include IME-aware editing, safe paste, search and replace,
preview, visual blocks, and table range merge/split. Configure status counts
with `wordCount: false` or `{ words, characters, selection }`.

See the repository README for configuration, React usage, and contributing
guidance.

# SB Editor

A dependency-free, framework-agnostic rich text editor for the web. SB Editor
provides a TypeScript core for direct DOM use and a small React wrapper, with
tables, links, images, source editing, undo/redo, keyboard shortcuts, and a
themeable editor UI included.

## Why SB Editor

- No runtime editor dependencies and no deprecated browser editing commands.
- A framework-free core with first-class React bindings.
- HTML in and out through `getContent()` and `setContent()` with sanitized markup.
- Responsive, accessible toolbar with automatic overflow, clipboard actions,
  menus, dialogs, keyboard shortcuts, and light/dark themes.
- Productive table editing: contextual actions, right-click menu, properties,
  column resizing, and whole-table resize handles.

## Packages

| Package            | Purpose                                                             |
| ------------------ | ------------------------------------------------------------------- |
| `@sb/editor-core`  | The editor engine and default UI for vanilla TypeScript/JavaScript. |
| `@sb/editor-react` | React component built on the same core.                             |

## Install

```bash
npm install @sb/editor-core
```

For React:

```bash
npm install @sb/editor-react react react-dom
```

> The package scope is currently `@sb`. Before the first public release,
> publish it under an npm scope you own and update package names and imports if
> that scope is different.

## Vanilla JavaScript

```ts
import { Editor } from '@sb/editor-core';
import '@sb/editor-core/theme.css';

const editor = Editor.init({
  target: document.querySelector('#editor')!,
  initialContent: '<p>Start writing.</p>'
});

editor.on('change', (html) => {
  console.log(html);
});
```

## React

```tsx
import { useState } from 'react';
import { Editor } from '@sb/editor-react';
import '@sb/editor-core/theme.css';

export function ArticleEditor() {
  const [value, setValue] = useState('<p>Start writing.</p>');

  return <Editor value={value} onChange={setValue} />;
}
```

Use `initialValue` for an uncontrolled editor. The component accepts `toolbar`,
`toolbarOverflow`, `menubar`, `statusbar`, and `resize` options from the core
configuration. Tool groups wrap onto additional rows by default; set
`toolbarOverflow: true` to keep one row and move extra groups into a More menu.

## Development

```bash
yarn install
yarn dev
yarn lint
yarn format
yarn test
yarn test:coverage
yarn e2e --project=chromium
yarn build
```

The demo runs at `http://localhost:5177` and shows vanilla and React editors
side by side.

## Publishing checklist

Before publishing, set a package scope you own, add the repository URL to both
package manifests, bump versions, then verify the packed files:

```bash
cd packages/core && npm pack --dry-run
cd ../react && npm pack --dry-run
```

Use npm provenance for public releases where your registry and CI setup support
it.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the local workflow and quality
checks. Security reports are handled through [SECURITY.md](./SECURITY.md).

## License

[MIT](./LICENSE)

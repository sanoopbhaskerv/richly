# Richly

A dependency-free, framework-agnostic rich text editor for the web. Richly
provides a TypeScript core for direct DOM use and a small React wrapper, with
advanced tables, search and replace, preview, links, images, source editing,
undo/redo, keyboard shortcuts, and a themeable editor UI included.

## Why Richly

- No runtime editor dependencies and no deprecated browser editing commands.
- A framework-free core with first-class React bindings.
- HTML in and out through `getContent()` and `setContent()` with sanitized markup.
- Responsive, accessible toolbar with automatic overflow, clipboard actions,
  menus, dialogs, keyboard shortcuts, and light/dark themes.
- Productive table editing: contextual actions, right-click menu, properties,
  multi-cell selection, merge/split, column resizing, and whole-table resize
  handles.
- IME-aware input and sanitized rich-text/plain-text paste handling.
- Search and replace, visual block outlines, document preview, and configurable
  word/character counts.

## Packages

| Package         | Purpose                                                             |
| --------------- | ------------------------------------------------------------------- |
| `@richly/core`  | The editor engine and default UI for vanilla TypeScript/JavaScript. |
| `@richly/react` | React component built on the same core.                             |

## Install

```bash
npm install @richly/core
```

For React:

```bash
npm install @richly/react react react-dom
```

## Vanilla JavaScript

```ts
import { Editor } from '@richly/core';
import '@richly/core/theme.css';

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
import { Editor } from '@richly/react';
import '@richly/core/theme.css';

export function ArticleEditor() {
  const [value, setValue] = useState('<p>Start writing.</p>');

  return <Editor value={value} onChange={setValue} />;
}
```

Use `initialValue` for an uncontrolled editor. The component accepts `toolbar`,
`toolbarOverflow`, `menubar`, `statusbar`, and `resize` options from the core
configuration. Tool groups wrap onto additional rows by default; set
`toolbarOverflow: true` to keep one row and move extra groups into a More menu.

Word counting can be disabled with `wordCount: false`, or configured in either
API:

```ts
wordCount: { words: true, characters: true, selection: true }
```

Hold Shift while clicking a second table cell—or drag across cells—to select a
rectangular range for Merge cells. Search and replace is available from the
Edit menu or `Mod+F`; preview and visual blocks are in the View menu.

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
yarn release:check
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

See [RELEASING.md](./RELEASING.md) for the SemVer and tag-driven release
process, [CHANGELOG.md](./CHANGELOG.md) for public release notes, and
[MIGRATING.md](./MIGRATING.md) for compatibility policy.

## Accessibility

Richly provides labelled editor controls, keyboard-operable toolbars and
dialogs, visible focus states, and semantic table output. Supported behavior
and current limitations are documented in
[ACCESSIBILITY.md](./ACCESSIBILITY.md).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the local workflow and quality
checks. Security reports are handled through [SECURITY.md](./SECURITY.md).

## License

[MIT](./LICENSE)

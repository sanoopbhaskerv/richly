# Richly

A dependency-free, framework-agnostic rich text editor for the web. Richly
provides a TypeScript core for direct DOM use and a small React wrapper, with
advanced tables, search and replace, preview, links, images, source editing,
undo/redo, keyboard shortcuts, and a themeable editor UI included.

**[Live demo →](https://sanoopbhaskerv.github.io/richly/)** — vanilla and React
editors side by side, including the custom plugin examples.

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
- Opinionated defaults you can opt out of — e.g. `blockquoteStyle: false` drops
  Richly's default blockquote look so you can fully own it with your own CSS.

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
  target: document.querySelector<HTMLElement>('#editor')!,
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
`toolbarMode`, `menubar`, `statusbar`, and `resize` options from the core
configuration. Tool groups wrap onto additional rows by default; set
`toolbarMode="more"` to keep one row and move extra groups into a More menu.
The deprecated `toolbarOverflow` alias remains available for 0.x migrations.

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
yarn a11y:audit
yarn build
```

The demo runs at `http://localhost:5177` and shows vanilla and React editors
side by side.

## Publishing checklist

Prepare an explicit release candidate, verify it, then tag the reviewed release
commit. Prerelease tags publish to npm under `next`; stable tags publish under
`latest`:

```bash
yarn release:prepare --version 1.0.0-rc.1
yarn release:check
git tag v1.0.0-rc.1

# After the RC soak, promote the prerelease base version.
yarn release:prepare
yarn release:check
git tag v1.0.0
```

Use npm provenance for public releases where your registry and CI setup support
it.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the local workflow and quality
checks. Security reports are handled through [SECURITY.md](./SECURITY.md).

## License

[MIT](./LICENSE)

# @richly/react

[![npm version](https://img.shields.io/npm/v/@richly/react.svg)](https://www.npmjs.com/package/@richly/react)
[![license](https://img.shields.io/npm/l/@richly/react.svg)](https://github.com/sanoopbhaskerv/richly/blob/main/LICENSE)
[![types](https://img.shields.io/npm/types/@richly/react.svg)](https://www.npmjs.com/package/@richly/react)

React bindings for [Richly](https://github.com/sanoopbhaskerv/richly) — a
dependency-free, framework-agnostic rich text (WYSIWYG) editor. This is a thin
wrapper around [`@richly/core`](https://www.npmjs.com/package/@richly/core);
the editing engine, commands, events, theming, and plugin API all live there.

- Controlled (`value` / `onChange`) or uncontrolled (`initialValue`) usage.
- Core configuration surfaced as props.
- Direct access to the underlying core `Editor` via `onInit` or a `ref`.

**[Try it live →](https://sanoopbhaskerv.github.io/richly/)**

---

## Install

```bash
npm install @richly/react @richly/core react react-dom
```

`react` and `react-dom` are peer dependencies (React 18+). `@richly/core` is a
direct dependency and provides the stylesheet.

## Quick start

### Uncontrolled

```tsx
import { Editor } from '@richly/react';
import '@richly/core/theme.css';

export function App() {
  return <Editor initialValue="<p>Start writing…</p>" onChange={(html) => console.log(html)} />;
}
```

### Controlled

```tsx
import { useState } from 'react';
import { Editor } from '@richly/react';
import '@richly/core/theme.css';

export function ArticleEditor() {
  const [value, setValue] = useState('<p>Start writing…</p>');
  return <Editor value={value} onChange={setValue} />;
}
```

> Import `@richly/core/theme.css` once in your app. Prefer `initialValue` unless
> you specifically need two-way binding; external `value` changes are pushed
> into the editor without adding an undo step.

## Props

`EditorProps` extends the core configuration. All props are optional.

| Prop           | Type                           | Description                                             |
| -------------- | ------------------------------ | ------------------------------------------------------- |
| `value`        | `string`                       | Controlled HTML value. Pair with `onChange`.            |
| `initialValue` | `string`                       | Initial HTML for uncontrolled use.                      |
| `onChange`     | `(html: string) => void`       | Called with sanitized HTML on every edit.               |
| `onInit`       | `(editor: CoreEditor) => void` | Receives the underlying core `Editor` once mounted.     |
| `toolbar`      | `string`                       | Toolbar spec (see the core README).                     |
| `toolbarMode`  | `'wrap' \| 'more'`             | Wrap groups (default) or collapse into a **More** menu. |
| `menubar`      | `boolean`                      | Show the menubar (default `true`).                      |
| `statusbar`    | `boolean`                      | Show the statusbar (default `true`).                    |
| `resize`       | `boolean`                      | Show the statusbar resize grip (default `true`).        |
| `wordCount`    | `boolean \| WordCountOptions`  | Configure word/character/selection counts.              |
| `images`       | `ImagesConfig`                 | Image upload hook, accept filter, and size limit.       |
| `plugins`      | `Plugin[]`                     | Additional plugins.                                     |
| `testIdPrefix` | `string`                       | Prefix for editor-chrome `data-testid` hooks.           |
| `className`    | `string`                       | Class applied to the host element.                      |

> `toolbarOverflow` is deprecated in favor of `toolbarMode` (`true` → `'more'`,
> `false` → `'wrap'`); it remains supported through the 0.x line.

## Accessing the core editor

Use `onInit` for a callback, or a `ref` for imperative access. The ref exposes
`{ editor }`, the core `Editor` instance (or `null` before mount).

```tsx
import { useRef } from 'react';
import { Editor, type EditorHandle } from '@richly/react';
import '@richly/core/theme.css';

export function WithToolbarActions() {
  const ref = useRef<EditorHandle>(null);

  return (
    <>
      <button onClick={() => ref.current?.editor?.execCommand('Bold')}>Bold</button>
      <Editor ref={ref} initialValue="<p>Hello.</p>" />
    </>
  );
}
```

From either entry point you get the full core API — `execCommand`,
`getContent`/`setContent`, `on(...)` events, `queryCommandState/Value`, and so
on. See the [`@richly/core` README](https://www.npmjs.com/package/@richly/core)
for the complete surface.

## Images, events, commands, theming, plugins

These are all provided by the core and configured identically here. Pass the
`images` prop for uploads, subscribe to editor events via `onInit`/`ref`, style
with the `--rly-*` CSS variables, and register `plugins`. Refer to the
[core README](https://www.npmjs.com/package/@richly/core) and the
[Plugin Authoring Guide](https://github.com/sanoopbhaskerv/richly/blob/main/docs/PLUGINS.md).

## TypeScript

```ts
import type { EditorProps, EditorHandle, CoreEditor } from '@richly/react';
```

Common core types (`EditorConfig`, `WordCountOptions`, `ToolbarMode`, `Plugin`,
`FindReplaceArgs`) are re-exported for convenience.

## Links

- [Live demo](https://sanoopbhaskerv.github.io/richly/)
- [Repository & full docs](https://github.com/sanoopbhaskerv/richly#readme)
- [Core package (`@richly/core`)](https://www.npmjs.com/package/@richly/core)
- [Plugin authoring guide](https://github.com/sanoopbhaskerv/richly/blob/main/docs/PLUGINS.md)
- [Changelog](https://github.com/sanoopbhaskerv/richly/blob/main/CHANGELOG.md)
- [Migration policy](https://github.com/sanoopbhaskerv/richly/blob/main/MIGRATING.md)
- [Accessibility support](https://github.com/sanoopbhaskerv/richly/blob/main/ACCESSIBILITY.md)

## License

[MIT](https://github.com/sanoopbhaskerv/richly/blob/main/LICENSE)

# Richly architecture

Richly is an open, dependency-free rich text editor with a TypeScript core
and optional React bindings. The editor keeps its document as live DOM and uses
HTML as its public interchange format.

## Design goals

- Framework-agnostic core with a small React wrapper.
- No deprecated browser editing commands.
- Strict TypeScript, deterministic commands, and a plugin-friendly API.
- Accessible, themeable UI built from DOM components and CSS custom properties.
- Sanitized inbound HTML and predictable HTML output.

## Core model

```text
input or paste → editable DOM → events → undo snapshots
toolbar/menu/dialog → command registry → DOM mutation → change event
getContent()/setContent() ↔ sanitized HTML
```

The command registry is the central mutation seam. Built-in features and user
plugins use the same API, so a plugin can register commands, toolbar buttons,
and menu items without special privileges.

## Packages

```text
packages/core   framework-free editor engine and default UI
packages/react  React component that owns one core editor instance
packages/demo   Vite playground for both integrations
```

### Theme source and packaging

`packages/core/src/ui/theme.css` is the ordered source manifest for the editor
theme. Its component partials live in `packages/core/src/ui/theme/`; add new
rules to the owning partial and preserve the manifest order because it defines
the CSS cascade. Development bundlers resolve those imports directly, while
`packages/core/scripts/copy-theme.mjs` inlines them into one dependency-free
`dist/theme.css`. The public import remains `@richly/core/theme.css`.

## Public API

```ts
const editor = Editor.init({ target, initialContent: '<p>Hello.</p>' });

editor.on('change', (html) => save(html));
editor.execCommand('Bold');
editor.getContent();
editor.destroy();
```

The React package exposes an `<Editor />` component with controlled (`value`) or
uncontrolled (`initialValue`) content, plus `onChange` and `onInit` callbacks.

## Quality approach

Commands and sanitization are unit tested with Vitest. Browser behavior is
tested with Playwright. Linting, formatting, build output, and tests are part of
the pull-request checks. See [TESTING.md](./TESTING.md) and
[CONTRIBUTING.md](./CONTRIBUTING.md).

## Known boundaries

Browser selection, IME composition, and clipboard normalization have dedicated
unit and browser coverage, including undo grouping and safe plain-text paste.
Table ranges support rectangular Shift/drag selection and merge/split; complex
pre-existing span grids remain an area for expanded fixture coverage.

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

### Toolbar composition

`packages/core/src/ui/Toolbar.ts` is the stable editor-facing coordinator. It
renders one internal model, selects a responsive strategy, subscribes command
state refresh, and installs keyboard navigation. Feature behavior is separated
under `packages/core/src/ui/toolbar/` by responsibility:

```text
Toolbar
├── ToolbarRenderer + ToolbarPanelControl  control DOM and panel lifecycle
├── ToolbarState                          command state → rendered state
├── ToolbarKeyboard                       roving tabindex in live DOM order
└── ToolbarLayoutServices
    ├── ToolbarMetrics                    shared width measurements
    ├── OverflowToolbar                   floating More panel strategy
    └── SlidingToolbar                    in-flow disclosure strategy
```

These dependencies flow in one direction: renderers never choose responsive
policy, layout strategies never query command state, and feature controls move
only as atomic sections. New layout modes should consume
`ToolbarLayoutServices`; new control types should extend `ToolbarRenderer` or a
dedicated renderer without reaching into overflow/sliding controllers. The
public `Toolbar` constructor, toolbar-spec syntax, DOM classes, accessibility
attributes, and test IDs remain compatibility boundaries.

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

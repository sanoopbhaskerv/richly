# Plugin Authoring Guide

Version target: 0.6.0
Package: @richly/core

This guide is the design + implementation contract for plugin authors.
If you have never read core source, you should still be able to build a plugin from this page alone.

## 1. Plugin anatomy

A plugin is a plain object with `{ name, init }`:

```ts
import type { Plugin } from '@richly/core';

export const myPlugin: Plugin = {
  name: 'my-plugin',
  init(editor) {
    // register commands, UI, events
  }
};
```

Use it when creating the editor:

```ts
import { Editor } from '@richly/core';
import { myPlugin } from './my-plugin';

Editor.init({
  target: document.getElementById('host')!,
  plugins: [myPlugin],
  toolbar: 'bold italic | my-action'
});
```

Design rules:

- Use a unique plugin `name` (kebab-case).
- Keep command names stable and PascalCase (for example `Highlight`).
- Emit `change` after DOM mutations so host integrations stay in sync.

## 2. Commands and undo/change contract

Register commands through `editor.commands.register`:

```ts
import type { Command } from '@richly/core';

const cmd: Command = {
  execute(editor, args) {
    // mutate DOM
    editor.events.emit('change', editor.getContent());
  },
  queryState(editor) {
    return false;
  },
  queryValue(editor) {
    return '';
  },
  skipUndo: false
};
```

Contract details:

- Undo snapshot: taken automatically before `execute` unless `skipUndo: true`.
- Change event: emit `editor.events.emit('change', editor.getContent())` after content mutation.
- No-range behavior: commands should gracefully no-op when `editor.selection.getRange()` is null.

Useful APIs:

- `editor.execCommand(name, args?)`
- `editor.queryCommandState(name)`
- `editor.queryCommandValue(name)`

## 3. UiRegistry: buttons, toggles, panels, selects, menus

All toolbar/menubar entries are registered via `editor.ui`.

### Button

```ts
editor.ui.addButton('my-action', {
  type: 'button',
  icon: 'removeformat',
  tooltip: 'My action',
  command: 'MyCommand'
});
```

### Toggle button

```ts
editor.ui.addToggleButton('highlight', {
  icon: 'visualblocks',
  tooltip: 'Highlight',
  command: 'Highlight'
});
```

### Panel button

```ts
editor.ui.addButton('my-panel', {
  type: 'panel',
  icon: 'table',
  tooltip: 'Panel',
  panel(editor, close) {
    const el = document.createElement('div');
    const run = document.createElement('button');
    run.textContent = 'Run';
    run.addEventListener('mousedown', (e) => {
      e.preventDefault();
      editor.execCommand('MyCommand');
      close();
      editor.focus();
    });
    el.appendChild(run);
    return el;
  }
});
```

### Select control

```ts
editor.ui.addButton('my-select', {
  type: 'select',
  tooltip: 'My select',
  command: 'SetMode',
  options: [
    { label: 'Default', value: '' },
    { label: 'A', value: 'a' }
  ]
});
```

### Menu item

```ts
editor.ui.addMenuItem('my-menu-item', {
  menu: 'format',
  text: 'My command',
  command: 'MyCommand'
});
```

## 4. Dialogs

Dialogs are declared through `openDialog` and return `DialogResult`:

```ts
import { openDialog } from '@richly/core';

const result = await openDialog(editor, {
  name: 'example',
  title: 'Example dialog',
  fields: [
    { name: 'title', label: 'Title', type: 'text' },
    { name: 'asset', label: 'Asset', type: 'file', accept: 'image/*' }
  ],
  submitText: 'Save'
});

if (result) {
  const title = result.title;
  const file = result.files?.asset;
}
```

Notes:

- `file` fields return selected files via `result.files`.
- Field name `files` is reserved.

## 5. Typed events

`EditorEvents` includes built-ins such as:

- `change` (payload: html string)
- `selectionchange`
- `execcommand`
- `imageuploadstart`, `imageuploadend`, `imageuploaderror`
- `destroy`

Listening:

```ts
editor.on('change', (html) => {
  console.log(html);
});
```

Plugin-specific events are allowed (string keys are supported at runtime):

```ts
(editor.events as { emit(name: string, data: unknown): void }).emit('myplugin:update', {
  value: 1
});
```

## 6. Selection utilities

Common calls:

- `editor.selection.getRange()`
- `editor.selection.setRange(range)`
- `editor.selection.getBookmark()` / `moveToBookmark(bookmark)`
- `editor.getBody()`
- `editor.getContent()`
- `editor.focus()`

Always null-check range before DOM operations.

## 7. CSS variables and theming

Import theme:

```ts
import '@richly/core/theme.css';
```

Core variables on `.rly` include:

- `--rly-surface`
- `--rly-border`
- `--rly-text`
- `--rly-accent`
- `--rly-radius`

Plugin CSS should prefer these tokens for visual consistency.

## 8. data-testid conventions

Use stable ids (never text-based selectors):

- Toolbar controls: `tb-<name>`
- Dropdown panels: `dd-<name>`
- Toolbar selects: `tb-select-<name>`
- Dialog fields: `dialog-field-<name>`
- Plugin statusbar elements: `status-<plugin>` style naming

When adding plugin-owned UI inside custom panels, assign explicit testids.

## 9. Public vs internal API

Public (from `@richly/core`) for plugin authors:

- `Plugin`
- `Command`
- `ButtonSpec`
- `EditorEvents`
- `DialogField`, `DialogSpec`, `DialogResult`
- `Editor` and its documented methods

Internal (do not import):

- `getEditorConfig`
- any path under `@richly/core/src/...`
- bundled plugin internals (`corePlugins` and module-private helpers)

## 10. Worked example: Highlight plugin (hello world)

Path: `examples/highlight-plugin/index.ts`

What it demonstrates:

- command registration
- toggle active state
- toggle button + menu item wiring
- proper `change` emission

## 11. Worked example: Word Goal plugin (realistic)

Path: `examples/word-goal-plugin/index.ts`

What it demonstrates:

- config-driven plugin factory
- statusbar integration
- plugin-owned custom event emission
- data-testid and ARIA usage

## 12. Acceptance checklist

A plugin guide is considered successful when:

- a new contributor can implement the highlight plugin using only this guide
- both example plugins have passing unit tests
- the public export snapshot test passes, freezing the plugin-authoring API surface for 1.0

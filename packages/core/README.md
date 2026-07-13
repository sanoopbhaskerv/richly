# @richly/core

[![npm version](https://img.shields.io/npm/v/@richly/core.svg)](https://www.npmjs.com/package/@richly/core)
[![license](https://img.shields.io/npm/l/@richly/core.svg)](https://github.com/sanoopbhaskerv/richly/blob/main/LICENSE)
[![types](https://img.shields.io/npm/types/@richly/core.svg)](https://www.npmjs.com/package/@richly/core)

A dependency-free, framework-agnostic rich text (WYSIWYG) editor for the web.
`@richly/core` is the TypeScript engine and default UI — mount it into any DOM
element with no framework required. For React, use
[`@richly/react`](https://www.npmjs.com/package/@richly/react), which wraps this
same core.

- **Zero runtime dependencies.** No legacy `document.execCommand`, no jQuery, no
  heavyweight framework.
- **HTML in, sanitized HTML out** via `getContent()` / `setContent()`.
- **Batteries included:** inline formats, colors and font sizes, headings and
  blocks, lists, alignment, indent, links, images (with an upload hook),
  advanced tables, find & replace, preview, source view, fullscreen, undo/redo,
  and a responsive, themeable, accessible UI.
- **Extensible:** a small command + plugin API that the bundled features are
  themselves built on.

**[Try it live →](https://sanoopbhaskerv.github.io/richly/)**

---

## Contents

- [Install](#install)
- [Quick start](#quick-start)
- [Getting content in and out](#getting-content-in-and-out)
- [Configuration](#configuration)
- [Toolbar](#toolbar)
- [Images and uploads](#images-and-uploads)
- [Text style presets](#text-style-presets)
- [Word count](#word-count)
- [Editor API](#editor-api)
- [Events](#events)
- [Commands](#commands)
- [Find and replace](#find-and-replace)
- [Blockquote styling](#blockquote-styling)
- [Theming](#theming)
- [Plugins](#plugins)
- [TypeScript](#typescript)
- [Browser support](#browser-support)
- [Links](#links)
- [License](#license)

---

## Install

```bash
npm install @richly/core
# or
yarn add @richly/core
# or
pnpm add @richly/core
```

The package ships ESM and CommonJS builds with bundled type definitions. Import
the stylesheet once, anywhere in your app.

## Quick start

```ts
import { Editor } from '@richly/core';
import '@richly/core/theme.css';

const editor = Editor.init({
  target: document.querySelector('#editor')!,
  initialContent: '<p>Start writing…</p>'
});

editor.on('change', (html) => {
  console.log(html); // sanitized HTML on every edit
});
```

You can mount by selector instead of an element:

```ts
Editor.init({ selector: '#editor' });
```

Tear the instance down when you are finished (removes the UI and listeners):

```ts
editor.destroy();
```

## Getting content in and out

`getContent()` returns sanitized HTML with editor-only artifacts (caret
fillers, transient highlight marks, upload placeholders) stripped.
`setContent()` sanitizes and replaces the document.

```ts
const html = editor.getContent();

editor.setContent('<h1>Report</h1><p>Body copy.</p>');

// Replace content without adding an undo step:
editor.setContent(html, { addUndoLevel: false });
```

## Configuration

Everything is optional except a mount point (`target` or `selector`).

```ts
Editor.init({
  target, // HTMLElement to mount into
  selector: '#editor', // …or a CSS selector (alternative to target)
  initialContent: '<p></p>', // starting HTML
  toolbar: 'bold italic | h1 h2', // toolbar spec (see below)
  toolbarMode: 'wrap', // 'wrap' (default) | 'more'
  menubar: true, // set false to hide the menubar
  statusbar: true, // set false to hide the statusbar
  resize: true, // set false to remove the resize grip
  wordCount: true, // true | false | { words, characters, selection }
  images: { upload: uploadFn }, // image upload hook (see below)
  textStyles: { colors, fontSizes }, // swatches + Format-menu size presets
  blockquoteStyle: true, // set false to opt out of the default blockquote look
  plugins: [myPlugin], // additional plugins
  testIdPrefix: 'editor' // prefix for chrome data-testids
});
```

| Option            | Type                          | Default    | Description                                                      |
| ----------------- | ----------------------------- | ---------- | ---------------------------------------------------------------- |
| `target`          | `HTMLElement`                 | —          | Element to mount into. Required unless `selector` is given.      |
| `selector`        | `string`                      | —          | CSS selector for the mount point.                                |
| `initialContent`  | `string`                      | `''`       | Initial HTML, sanitized on load.                                 |
| `toolbar`         | `string`                      | full set   | Space/`\|`-separated toolbar spec.                               |
| `toolbarMode`     | `'wrap' \| 'more'`            | `'wrap'`   | Wrap groups onto new rows, or keep one row with a **More** menu. |
| `menubar`         | `boolean`                     | `true`     | Show the menubar.                                                |
| `statusbar`       | `boolean`                     | `true`     | Show the statusbar.                                              |
| `resize`          | `boolean`                     | `true`     | Show the statusbar resize grip.                                  |
| `wordCount`       | `boolean \| WordCountOptions` | `true`     | Word/character/selection counts in the statusbar.                |
| `images`          | `ImagesConfig`                | —          | Upload hook, accept filter, and size limit.                      |
| `textStyles`      | `{ colors?, fontSizes? }`     | presets    | Color swatches and Format-menu font-size presets.                |
| `blockquoteStyle` | `boolean`                     | `true`     | Set `false` to opt out of Richly's default blockquote styling.   |
| `plugins`         | `Plugin[]`                    | `[]`       | Extra plugins registered after the defaults.                     |
| `testIdPrefix`    | `string`                      | `'editor'` | Prefix for `data-testid` hooks on the editor chrome.             |

> **Note:** `toolbarOverflow` is deprecated in favor of `toolbarMode`.
> `toolbarOverflow: true` maps to `toolbarMode: 'more'` and `false` to
> `'wrap'`. It remains supported through the 0.x line.

## Toolbar

The toolbar is a string of command button names. Use `|` to insert a group
separator. The default toolbar is:

```
undo redo | selectall copy cut paste |
bold italic underline strikethrough superscript subscript |
forecolor backcolor fontsize | h1 h2 paragraph blockquote |
alignleft aligncenter alignright | bullist numlist outdent indent |
link unlink table image | findreplace preview visualblocks |
code fullscreen removeformat
```

Provide your own subset to trim it down:

```ts
Editor.init({
  target,
  toolbar: 'bold italic underline | h1 h2 | bullist numlist | link'
});
```

With `toolbarMode: 'more'`, groups that do not fit on one row collapse into a
**More** menu; with the default `'wrap'`, they wrap onto additional rows so
every tool stays visible.

## Images and uploads

Without configuration, the image dialog accepts a URL. Provide an `upload`
handler to enable file selection in the dialog plus paste-file and drag-and-drop
uploads. The handler receives a `File` and resolves with a `src` (and optional
`alt`).

```ts
Editor.init({
  target,
  images: {
    accept: 'image/png,image/jpeg', // default: 'image/*'
    maxBytes: 5 * 1024 * 1024, // reject larger files before uploading
    upload: async (file) => {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const { url } = await res.json();
      return { src: url, alt: file.name };
    }
  }
});
```

While an upload is in flight a placeholder image is shown; on success its `src`
is swapped in, and on failure the placeholder is removed and an
`imageuploaderror` event is emitted. Selected images show a resize frame with
corner handles.

## Text styles and font size

The toolbar's font-size control accepts any pixel value from `1` to `512`,
including decimals with up to two places. Type a value and press Enter, use
Arrow Up/Down, or click −/+ to apply it to the complete selection. Clearing the
field removes explicit sizing and returns the text to its inherited size. Mixed
selections display the computed size at the first selected text position.

Customize the color swatches and font-size presets offered by the Format menu.
The built-in defaults are exported so you can extend rather than replace them.
Both the text-color and background-color palettes include a Richly-native
advanced picker in the same popover. It provides saturation/brightness, hue,
opacity, synchronized HEX and slider views, recent colors, presets, and an
explicit Cancel/Done flow for colors outside the configured swatches.

```ts
import { Editor, DEFAULT_COLORS, DEFAULT_FONT_SIZES } from '@richly/core';

Editor.init({
  target,
  textStyles: {
    colors: [...DEFAULT_COLORS, '#00b894'],
    fontSizes: ['14px', '16px', '20px', '28px'] // default: 12/14/16/18/24/32px
  }
});
```

For a custom toolbar or host UI, the same control is available as a reusable
component. Its defaults are `min: 1`, `max: 512`, `step: 1`, `largeStep: 5`,
and `fallbackSize: 16`:

```ts
import { createFontSizeControl } from '@richly/core';

const fontSize = createFontSizeControl({ editor });
toolbar.append(fontSize.element);

// When the host UI is removed independently of the editor:
fontSize.destroy();
```

## Word count

```ts
Editor.init({ target, wordCount: false }); // hide
Editor.init({
  target,
  wordCount: { words: true, characters: true, selection: true }
});
```

With `selection: true`, the statusbar reports counts for a non-collapsed
selection instead of the whole document.

## Editor API

`Editor.init(config)` returns an `Editor` instance:

| Member                       | Description                                              |
| ---------------------------- | -------------------------------------------------------- |
| `getContent(): string`       | Sanitized HTML of the document.                          |
| `setContent(html, opts?)`    | Replace content. `opts.addUndoLevel` (default `true`).   |
| `execCommand(name, args?)`   | Run a command by name (see [Commands](#commands)).       |
| `queryCommandState(name)`    | Whether a toggle command is currently active.            |
| `queryCommandValue(name)`    | Current value of a command (e.g. `FontSize` → `'16px'`). |
| `on(event, fn)` / `off(...)` | Subscribe/unsubscribe to [events](#events).              |
| `focus()`                    | Focus the editable area.                                 |
| `getBody()` / `getRoot()`    | The content element / the editor chrome root.            |
| `destroy()`                  | Remove the editor and all listeners.                     |

The instance also exposes `selection`, `commands`, `undoManager`, and `events`
for advanced and plugin use.

## Events

Subscribe with `editor.on(name, handler)`. Handlers receive the payload shown.

| Event              | Payload           | Fires when                                 |
| ------------------ | ----------------- | ------------------------------------------ |
| `init`             | `void`            | The editor finishes initializing.          |
| `change`           | `string` (HTML)   | Content changes (typing, commands, paste). |
| `input`            | `void`            | Raw input in the editable area.            |
| `selectionchange`  | `void`            | The selection or caret moves.              |
| `focus` / `blur`   | `void`            | The editable area gains/loses focus.       |
| `keydown`          | `KeyboardEvent`   | A key is pressed in the editor.            |
| `execcommand`      | `{ name, args? }` | A command runs.                            |
| `imageuploadstart` | `{ file }`        | An image upload begins.                    |
| `imageuploadend`   | `{ file, src }`   | An image upload resolves.                  |
| `imageuploaderror` | `{ file, error }` | An image upload rejects.                   |
| `destroy`          | `void`            | The editor is destroyed.                   |

```ts
editor.on('change', (html) => save(html));
editor.on('imageuploaderror', ({ file, error }) => toast(`Upload failed: ${file.name}`));
```

## Commands

Anything in the UI is a named command you can also invoke programmatically:

```ts
editor.execCommand('Bold');
editor.execCommand('FormatBlock', 'h2');
editor.execCommand('ForeColor', '#e5484d');
editor.execCommand('FontSize', { value: '18px' });
editor.execCommand('FontSize', { value: null }); // remove explicit size
editor.execCommand('InsertLink', { href: 'https://example.com', text: 'Example' });

editor.queryCommandState('Bold'); // → boolean
editor.queryCommandValue('FontSize'); // → '18px'
```

Built-in command names include:

- **Inline:** `Bold`, `Italic`, `Underline`, `Strikethrough`, `Superscript`,
  `Subscript`, `ForeColor`, `BackColor`, `FontSize`, `RemoveFormat`
- **Blocks & lists:** `FormatBlock`, `InsertOrderedList`,
  `InsertUnorderedList`, `Indent`, `Outdent`
- **Insert:** `InsertLink`, `Unlink`, `InsertImage`, `InsertTable`,
  `InsertHorizontalRule`
- **Tables:** `TableInsertRowBefore`/`After`, `TableInsertColBefore`/`After`,
  `TableDeleteRow`, `TableDeleteCol`, `TableDelete`, `TableMergeCells`,
  `TableSplitCell`, `TableProps`, `RowProps`, `CellProps`
- **Clipboard & history:** `SelectAll`, `Copy`, `Cut`, `Paste`, `Undo`, `Redo`
- **Document tools:** `FindReplace`, `Preview`, `VisualBlocks`, `SourceCode`,
  `ToggleFullscreen`

## Find and replace

Open the find & replace panel from the **Edit** menu, the toolbar search button,
or `Mod+F`. It is a live search session: type a query to see a match counter
("2 of 20") with every match highlighted and the current one emphasized. Use
**Find Next**/**Find Previous** (or `Enter` / `Shift+Enter`) to walk matches,
**Replace** for one at a time, and **Replace All** for the rest. Match case and
whole-word options are available; highlight marks never appear in
`getContent()`.

## Blockquote styling

By default, `<blockquote>` gets Richly's opinionated look — an accent-colored
left border, a tinted background, and a rounded corner. Not every consumer
wants that; set `blockquoteStyle: false` to opt out and fall back to the
browser's plain `<blockquote>` rendering:

```ts
Editor.init({ target, blockquoteStyle: false });
```

With the default styling withheld, nothing in Richly's stylesheet targets
blockquotes anymore, so your own CSS applies with no specificity fight:

```css
.rly-content blockquote {
  border-left: 4px solid #94a3b8;
  font-style: italic;
  padding-left: 1em;
}
```

`blockquoteStyle: false` only withholds the presentation hook — the editing
behavior (Enter/Backspace escaping the quote, keyboard shortcuts, sanitizer
rules) is unaffected either way.

## Theming

Every color is a CSS custom property, so theming is plain CSS. Dark mode
activates when any ancestor has `data-theme="dark"`.

```css
.rly {
  --rly-accent: #6d28d9;
  --rly-radius: 12px;
}

/* Your own dark palette */
[data-theme='dark'] .rly {
  --rly-surface: #14161a;
  --rly-text: #e6e9ee;
}
```

Common variables include `--rly-surface`, `--rly-surface-2`, `--rly-border`,
`--rly-text`, `--rly-text-dim`, `--rly-accent`, `--rly-hover`, `--rly-active`,
and `--rly-radius`.

## Plugins

The bundled features are built on a small public plugin API — a plugin is an
object with a `name` and an `init(editor)` function that registers commands and
UI. This minimal plugin adds a command and a toolbar button:

```ts
import { Editor, type Plugin } from '@richly/core';

const shoutPlugin: Plugin = {
  name: 'shout',
  init(editor) {
    editor.commands.register('Shout', {
      execute: (ed) => ed.setContent(ed.getContent().toUpperCase())
    });
    editor.ui.addButton('shout', { icon: 'bold', tooltip: 'Shout', command: 'Shout' });
  }
};

Editor.init({ target, plugins: [shoutPlugin] });
```

See the [Plugin Authoring Guide](https://github.com/sanoopbhaskerv/richly/blob/main/docs/PLUGINS.md)
for commands and the undo/`change` contract, UI registration (buttons, toggles,
panels, selects, menu items), dialogs, typed events, and selection utilities.

## TypeScript

The package is written in TypeScript and ships its own declarations. Public
types are exported from the package root:

```ts
import type {
  EditorConfig,
  EditorEvents,
  ImagesConfig,
  WordCountOptions,
  ToolbarMode,
  Plugin,
  Command,
  ButtonSpec,
  FindReplaceArgs,
  DialogSpec,
  DialogField,
  DialogResult,
  Bookmark
} from '@richly/core';

import { Editor, openDialog, sanitize, DEFAULT_COLORS, DEFAULT_FONT_SIZES } from '@richly/core';
```

`sanitize(html, document)` is exported for reusing the editor's sanitizer
outside the instance.

## Browser support

Modern evergreen browsers — Chromium (Chrome, Edge), Firefox, and WebKit
(Safari). The editor is exercised against all three in continuous integration.

## Links

- [Live demo](https://sanoopbhaskerv.github.io/richly/)
- [Repository & full docs](https://github.com/sanoopbhaskerv/richly#readme)
- [React bindings (`@richly/react`)](https://www.npmjs.com/package/@richly/react)
- [Plugin authoring guide](https://github.com/sanoopbhaskerv/richly/blob/main/docs/PLUGINS.md)
- [Changelog](https://github.com/sanoopbhaskerv/richly/blob/main/CHANGELOG.md)
- [Migration policy](https://github.com/sanoopbhaskerv/richly/blob/main/MIGRATING.md)
- [Accessibility support](https://github.com/sanoopbhaskerv/richly/blob/main/ACCESSIBILITY.md)

## License

[MIT](https://github.com/sanoopbhaskerv/richly/blob/main/LICENSE)

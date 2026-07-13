# Migration policy

This document describes how Richly communicates and supports compatibility
changes.

## Support policy

- Patch releases do not intentionally break documented APIs or serialized
  content.
- Minor releases add compatible functionality. Before 1.0, a minor release may
  contain a necessary breaking change when the changelog and this guide provide
  an explicit migration path.
- Major releases may remove deprecated APIs or change compatibility surfaces.
- Deprecations remain available for at least one minor release whenever a safe
  compatibility bridge is practical.

Each breaking migration documents the affected versions, who is affected,
before/after examples, serialized-content implications, and a rollback path.

## Compatibility surfaces

Treat changes to these areas as public migrations:

- package names, exports, and peer dependency ranges;
- exported TypeScript types and React props;
- editor configuration, commands, events, and plugin contracts;
- documented CSS variables, theme entry points, and stable test IDs;
- sanitizer behavior and generated HTML semantics.

Internal DOM structure and undocumented CSS classes may change without notice.

## 0.x → 1.0

Richly 1.0 freezes the surfaces below for the lifetime of the 1.x release
line. Additive fields, commands, events, exports, CSS tokens, and sanitizer
allowances may arrive in minor releases; removing or incompatibly changing a
listed surface requires a 2.0 migration. A security fix may reject input that
was previously accepted when retaining it would be unsafe.

### Package entry points and exports

The supported entry points are `@richly/core`, `@richly/core/theme.css`, and
`@richly/react`. Do not deep-import files under `src` or `dist`.

`@richly/core` exports these runtime values and types:

```text
Editor, openDialog, sanitize, TOOLBAR_PRESETS, DEFAULT_COLORS, DEFAULT_FONT_SIZES
Bookmark, ButtonSpec, Command, DialogField, DialogResult, DialogSpec,
EditorConfig, EditorEvents, FindReplaceArgs, ImagesConfig, LineHeightOption,
ListStyleOption, MenuControl, Plugin, SplitControl, ToolbarMenuItem,
ToolbarMode, ToolbarPreset, WordCountOptions
```

`@richly/react` exports `Editor`, `EditorProps`, `EditorHandle`, `CoreEditor`,
`EditorConfig`, `FindReplaceArgs`, `ImagesConfig`, `Plugin`, `ToolbarMode`, and
`WordCountOptions`.

The frozen `Editor` instance surface is `events`, `ui`, `commands`,
`selection`, `undoManager`, `getBody`, `getRoot`, `getContent`, `setContent`,
`execCommand`, `queryCommandState`, `queryCommandValue`, `on`, `off`, `focus`,
and `destroy`, plus the `Editor.init(config)` constructor.

### Configuration

`EditorConfig` supports:

```ts
interface EditorConfig {
  target?: HTMLElement;
  selector?: string;
  initialContent?: string;
  toolbar?: string;
  toolbarPreset?: 'essential' | 'standard' | 'complete';
  toolbarMode?: 'wrap' | 'more' | 'sliding';
  /** @deprecated; true = more, false = wrap */
  toolbarOverflow?: boolean;
  menubar?: boolean;
  statusbar?: boolean;
  wordCount?:
    | boolean
    | {
        words?: boolean;
        characters?: boolean;
        selection?: boolean;
      };
  resize?: boolean;
  plugins?: Plugin[];
  testIdPrefix?: string;
  textStyles?: {
    colors?: string[];
    themeColors?: string[];
    fontSizes?: string[];
    lineHeights?: Array<{ label: string; value: string }>;
  };
  listStyles?: {
    bullets?: Array<{ label: string; value: string }>;
    numbers?: Array<{ label: string; value: string }>;
  };
  images?: {
    upload?: (file: File) => Promise<{ src: string; alt?: string }>;
    accept?: string;
    maxBytes?: number;
  };
  blockquoteStyle?: boolean;
}
```

One of `target` or `selector` is required; `target` wins when both are set.
`toolbarMode` wins over `toolbarOverflow`. The deprecated
`toolbarOverflow` compatibility alias remains supported throughout 1.x.
`sliding` is an additive layout mode: it keeps one primary row and reveals
overflow groups in an inline drawer. The alias `toolbarOverflow: true`
continues to select the floating `more` mode.

An explicit `toolbar` string wins over `toolbarPreset`. Presets are additive;
applications that omit both options retain the release-candidate default.
Within toolbar strings, `|` separates an atomic group and `||` starts an
intentional row in `wrap` mode.

`textStyles.themeColors` prepends brand colors to both the text-color and
highlight-color palettes. Duplicates within `themeColors` and matching base HEX
entries are removed. The existing `textStyles.colors` option continues to
replace the base palette; when both are provided, theme colors appear first and
the replacement palette follows.

The React `EditorProps` surface mirrors the applicable core options through
`toolbar`, `toolbarPreset`, `toolbarMode`, `toolbarOverflow`, `menubar`,
`statusbar`, `wordCount`, `resize`, `textStyles`, `listStyles`, `images`,
`blockquoteStyle`, `plugins`, and `testIdPrefix`, and adds `value`,
`initialValue`, `onChange`, `onInit`, and `className`.

### Built-in commands and arguments

Command lookup is ASCII case-insensitive; the canonical spellings below are
used in documentation and event payloads preserve the spelling supplied by the
caller.

Commands without arguments are:

```text
Bold, Italic, Underline, Strikethrough, Superscript, Subscript, RemoveFormat,
JustifyLeft, JustifyCenter, JustifyRight, JustifyFull,
InsertUnorderedList, InsertOrderedList, Indent, Outdent, Unlink,
InsertHorizontalRule, Undo, Redo, SelectAll, Copy, Cut, Paste,
SourceCode, Preview, VisualBlocks, ToggleFullscreen,
TableInsertRowBefore, TableInsertRowAfter, TableInsertColBefore,
TableInsertColAfter, TableDeleteRow, TableDeleteCol, TableDelete,
TableMergeCells, TableSplitCell,
FormatBlock:h1, FormatBlock:h2, FormatBlock:h3, FormatBlock:h4,
FormatBlock:h5, FormatBlock:h6, FormatBlock:p, FormatBlock:pre,
FormatBlock:blockquote, RemoveList
```

Commands with arguments use these shapes. Optional arguments on dialog-backed
commands open the built-in UI when omitted.

```ts
FormatBlock: string | { tag?: string };
ForeColor: string; // empty string removes the color
BackColor: string; // empty string removes the highlight
FontSize: string; // empty string removes the explicit size
LineHeight: string; // configured unitless value; empty removes explicit spacing
ApplyList: { kind: 'ul' | 'ol'; style?: string };
InsertLink: { href: string; text?: string } | undefined;
InsertImage: { src: string; alt?: string } | undefined;
InsertTable: { rows?: number; cols?: number };
FindReplace: FindReplaceArgs | undefined;
TableProps: {
  width?: string;
  height?: string;
  align?: 'none' | 'center' | 'right';
  striped?: string | boolean;
  caption?: string | boolean;
  headerRow?: string | boolean;
  borderWidth?: string;
  borderColor?: string;
  cellPadding?: string;
} | undefined;
CellProps: {
  width?: string;
  type?: 'td' | 'th';
  scope?: '' | 'row' | 'col';
  halign?: '' | 'left' | 'center' | 'right';
  valign?: '' | 'top' | 'middle' | 'bottom';
  bg?: string;
} | undefined;
RowProps: {
  section?: 'head' | 'body' | 'foot';
  height?: string;
  align?: '' | 'left' | 'center' | 'right';
  valign?: '' | 'top' | 'middle' | 'bottom';
  bg?: string;
} | undefined;
```

`FindReplaceArgs` contains `find`, optional `replace`, optional `action`
(`find`, `replace`, or `replaceAll`), and optional `caseSensitive` and
`wholeWord` booleans.

### Events

The built-in event names and payloads are:

```ts
init: void;
change: string; // current sanitized HTML
input: void;
selectionchange: void;
focus: void;
blur: void;
keydown: KeyboardEvent;
execcommand: { name: string; args?: unknown };
imageuploadstart: { file: File };
imageuploadend: { file: File; src: string };
imageuploaderror: { file: File; error: unknown };
destroy: void;
```

### Theme and UI hooks

The stable CSS custom properties are `--rly-surface`, `--rly-surface-2`,
`--rly-border`, `--rly-text`, `--rly-text-dim`, `--rly-accent`,
`--rly-hover`, `--rly-active`, and `--rly-radius` on `.rly`.

The stable documented classes are `.rly` (editor root), `.rly-content`
(editable content), `.rly-blockquote-styled` (the optional default blockquote
presentation hook), `.rly-striped` (serialized table striping), `.rly-match`,
and `.rly-match-current` (transient find/replace highlights). Other Richly CSS
classes describe internal DOM and may change in a minor release.

The data-testids listed in `TESTING.md` are stable integration hooks through
1.x. A custom `testIdPrefix` changes only the documented editor chrome prefix.

### Sanitized HTML

The 1.0 sanitizer accepts these elements:

```text
p, h1, h2, h3, h4, h5, h6, blockquote, pre, div, br, hr, strong, b, em, i,
u, s, strike, del, code, sub, sup, span, ul, ol, li, a, img, table, colgroup,
col, thead, tbody, tfoot, tr, td, th, caption, figure, figcaption
```

All accepted elements may carry `style`, `class`, `id`, `dir`, `lang`, and
`title`. Additionally, links may carry `href`, `target`, and `rel`; images may
carry `src`, `alt`, `width`, and `height`; cells may carry `colspan` and
`rowspan`; and header cells may carry `scope`.

Allowed inline style properties are `color`, `background-color`, `text-align`,
`text-decoration`, `font-weight`, `font-style`, `font-size`, `font-family`,
`line-height`, `margin-left`, `margin-right`, `padding-left`, `width`, `height`,
`vertical-align`, `border-width`, `border-color`, `padding`, and
`table-layout`.

Unknown wrappers are unwrapped while their children are retained. `script`,
`style`, `iframe`, `object`, `embed`, `form`, `meta`, `link`, `head`, and
`title` subtrees are removed. Event-handler attributes and unsafe URL schemes
are removed; image data URLs are limited to PNG, GIF, JPEG, and WebP.

## Unreleased: toolbar layout naming

`toolbarOverflow` is deprecated because the boolean did not communicate whether
tools would wrap, clip, or move into a menu. Use the explicit `toolbarMode`
option instead:

```ts
// Before — still supported
toolbarOverflow: true;

// After
toolbarMode: 'more';
```

For an inline expandable drawer instead of a floating panel, use:

```ts
toolbarMode: 'sliding';
```

`toolbarOverflow: false` maps to `toolbarMode: 'wrap'`. When both options are
provided, `toolbarMode` takes precedence. The compatibility alias remains
supported throughout 1.x and may only be removed in a future major release.

## 0.1.0

This is the first public Richly release, so no migration is required. Earlier
development builds used the names `SB Editor`, `@sb/editor-core`, and
`@sb/editor-react`; those unpublished names are replaced by `Richly`,
`@richly/core`, and `@richly/react`.

# Quill-less: A TinyMCE-class WYSIWYG Editor — Design Document

**Status:** Draft for review · **Author:** Claude + Sanoop · **Date:** 2026-07-10

## 1. Goals

Build an open, dependency-free rich text editor that matches the TinyMCE open-source (free) feature set, works in **vanilla JS and React** from one codebase, and can grow beyond TinyMCE later (premium-style features, eventually collaboration).

Non-goals for v1: real-time collaboration, mobile-native apps, IE11.

## 2. Core architectural decisions

### 2.1 Framework-agnostic core + thin wrappers

One TypeScript core with zero dependencies. React support is a ~200-line wrapper, not a separate implementation. This is exactly how TinyMCE, CKEditor, and Tiptap ship multi-framework support.

```
packages/
  core/        @sb/editor-core     — engine, commands, plugins, UI (framework-free)
  react/       @sb/editor-react    — <Editor> component + hooks
  demo/        dev playground (Vite)
```

Vanilla usage:

```js
import { Editor } from '@sb/editor-core';
const editor = Editor.init({ selector: '#mytext', plugins: ['lists','link','table'] });
```

React usage:

```jsx
import { Editor } from '@sb/editor-react';
<Editor value={html} onChange={setHtml} plugins={['lists','link','table']} />
```

### 2.2 contentEditable + command layer (no `document.execCommand`)

`document.execCommand` is deprecated and inconsistent across browsers. We use `contentEditable` only as the input surface, and implement all mutations ourselves via the Range/Selection APIs through a **command layer**:

- **SelectionManager** — normalizes selection, saves/restores it across toolbar clicks and dialogs.
- **DomUtils** — inline format toggling (split/merge text nodes), block transforms, wrapping/unwrapping.
- **UndoManager** — snapshot-based history (serialized content + selection bookmarks), with input coalescing (typing bursts = one undo level). Simple, correct, and what TinyMCE itself does.
- **Sanitizer/Schema** — whitelist-based HTML schema. Everything entering the document (paste, setContent, drop) is parsed and cleaned against it. This is the paste-from-Word defense.

### 2.3 Everything is a command; every feature is a plugin

```ts
editor.execCommand('Bold');
editor.execCommand('InsertTable', { rows: 3, cols: 4 });
editor.queryCommandState('Bold');   // → toolbar button active state
```

Commands are registered in a registry; toolbar buttons, menu items, and keyboard shortcuts are all just bindings to commands. Plugin interface:

```ts
interface Plugin {
  name: string;
  init(editor: Editor): void;   // register commands, buttons, menu items, shortcuts
}
editor.ui.registry.addToggleButton('bold', { icon: 'bold', command: 'Bold' });
```

Core (bold, italic, undo, lists…) uses the same API as user plugins — no privileged code paths. This is what makes "eventually more features" cheap.

### 2.4 Event bus

Typed emitter: `init`, `change`, `input`, `selectionchange`, `focus/blur`, `beforepaste/paste`, `keydown`, `execcommand`, `dirty`. UI subscribes to state; React wrapper bridges these to props/hooks.

### 2.5 UI layer

Framework-free DOM components, themed entirely with CSS custom properties (light/dark ships free):

- **Toolbar** — configurable via string spec like TinyMCE: `"undo redo | bold italic | bullist numlist"`, overflow into "more" drawer on narrow widths.
- **Menubar** — File / Edit / View / Insert / Format / Tools / Table / Help.
- **Dialogs** — declarative spec → rendered form (link, image, table props, search & replace). Focus-trapped, keyboard accessible.
- **Context toolbar** (quickbars) — floats above selection; contextual for images/tables.
- **Statusbar** — element path (`p › strong`), word count, resize grip.

Accessibility is a feature, not a pass: full ARIA roles, roving tabindex in toolbar, Alt+F9/F10/F11 focus jumps (TinyMCE muscle memory), all commands keyboard-reachable.

## 3. TinyMCE free-tier parity map

| Area | Features | Phase |
|---|---|---|
| Inline formatting | bold, italic, underline, strikethrough, sub/superscript, code, text/bg color, font family/size, clear formatting | 1 |
| Blocks | paragraphs, H1–H6, blockquote, pre, alignment, indent/outdent, line height | 1 |
| History | undo/redo with coalescing | 1 |
| Lists (`lists`, `advlist`) | ul/ol, nesting via Tab, list styles | 1 |
| Links (`link`, `autolink`) | insert/edit dialog, auto-link on typing URLs | 2 |
| Clipboard | clean paste from Word/GDocs, paste as text | 2 |
| Tables (`table`) | insert grid picker, row/col ops, merge/split, resize | 2 |
| Media (`image`, `media`) | image dialog + upload hook, resize handles, video embed | 2 |
| Code (`code`, `codesample`) | source view, syntax-highlighted code blocks | 2 |
| Search (`searchreplace`) | find/replace with match highlighting | 2 |
| View (`fullscreen`, `preview`, `visualblocks`, `visualchars`, `wordcount`) | | 2 |
| Inserts (`charmap`, `emoticons`, `anchor`, `insertdatetime`, `nonbreaking`, `pagebreak`, `hr`, `accordion`) | | 3 |
| Misc (`autosave`, `autoresize`, `directionality`, `quickbars`, `help`, `save`) | | 3 |
| **Beyond TinyMCE free** | markdown shortcuts (`## ` → H2), slash commands, mentions, export PDF/Word, collab-ready model | 4+ |

Phase 1 delivers a genuinely usable editor; each later phase is additive plugins.

## 4. Data flow

```
keystroke/paste → contentEditable → input event → Sanitizer (paste only)
toolbar/menu/shortcut → execCommand → DomUtils mutation → UndoManager snapshot
                              ↘ events → UI state refresh (button active states, element path)
getContent() → serializer (schema-clean HTML out)
```

Content is stored as DOM in the editable body; HTML string is the interchange format (`getContent`/`setContent`), same contract as TinyMCE.

## 5. Tooling & quality

- **Yarn workspaces + Vite + TypeScript strict**, Vitest + jsdom for unit tests, Playwright (chromium/firefox/webkit) for e2e. All UI carries stable `data-testid`s — see TESTING.md for the full plan and testid registry.
- Commands are the test seam: `setContent → execCommand → assert getContent` needs no browser for most cases.
- Bundle target: core + phase-1 plugins under ~50 KB gzipped.

## 6. Risks & honest notes

- **Selection/IME edge cases** are the hard 20% of any editor (browser quirks, composition input, triple-click). Mitigation: normalize selection at one choke point, snapshot-based undo (recovers from anything), and lean on tests.
- Paste-from-Word cleaning is iterative — ship a good whitelist first, refine with real-world samples.
- From-scratch means we accept some rough edges early in exchange for full ownership. If we ever hit a wall, the command-layer design lets us swap the model layer without rewriting UI/plugins.

## 7. Proposed first milestone (after design sign-off)

Monorepo scaffold → core engine (selection, commands, undo, schema) → toolbar UI → phase-1 plugins → React wrapper → demo page with tests. Deliverable: working editor with the Phase-1 row above, usable in both vanilla and React.

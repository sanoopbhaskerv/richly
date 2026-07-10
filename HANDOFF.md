# HANDOFF — Agent Continuation Guide

> **Read this first.** This file lets any coding agent resume the project cold.
> Companion docs: `DESIGN.md` (architecture, authoritative) · `mockup.html` (approved-pending UX direction).

## 1. Project

Build **a from-scratch TinyMCE-clone WYSIWYG HTML editor** for user **Sanoop** (sanoopbhasker.study@gmail.com). Target: feature parity with TinyMCE open-source free tier, then beyond. Must work in **vanilla JS and React** from one codebase.

Reference for parity: https://www.tiny.cloud/blog/tinymce-free-wysiwyg-html-editor/ and DESIGN.md §3 parity table.

## 2. Decisions already made (do not relitigate without asking Sanoop)

| Decision | Choice | Why |
|---|---|---|
| Engine | **From scratch**: contentEditable + custom command layer. **No ProseMirror, no `document.execCommand`** in the real editor | Ownership + learning; execCommand is deprecated |
| Language | **TypeScript (strict)** | Typed plugin/command APIs |
| Structure | Yarn workspaces monorepo: `packages/core` (zero-dep, framework-free), `packages/react` (thin wrapper), `packages/demo` (Vite playground) | One core, many frameworks |
| React priority | React and vanilla ship together, but if forced to sequence, **React first** (user's words) — note the core IS the vanilla API, so this mostly means "polish the React wrapper first" |
| UI | Framework-free DOM components, CSS custom properties, light+dark themes | See mockup.html |
| Undo | Snapshot-based with typing coalescing (not operation-based) | Simpler, robust |
| Content model | Live DOM in editable body; HTML string as interchange (`getContent`/`setContent`) | Same contract as TinyMCE |
| Everything is a plugin | Core formatting uses same Plugin/Command API as extras | Extensibility |

User preferences: concise communication; wants design review checkpoints before big steps; open to feedback.

## 3. Current state (as of 2026-07-10, evening)

Design was **approved by Sanoop**. Yarn (not pnpm) per his request. Monorepo scaffolded and core v0 implemented:

```
HTMlEditor/
  DESIGN.md, TESTING.md, HANDOFF.md, mockup.html   docs (TESTING.md = test plan + data-testid registry)
  package.json, tsconfig.base.json                 Yarn workspaces root
  playwright.config.ts, e2e/                       Playwright: EditorPage page object + basic-formatting.spec.ts
  packages/core/     @sb/editor-core — Emitter, Editor, SelectionManager, DomUtils,
                     CommandRegistry, UndoManager, Sanitizer, UiRegistry, Toolbar,
                     Statusbar, theme.css, plugins/{history,formats,blocks}
  packages/core/src/__tests__/   25 unit tests — ALL PASSING (vitest+jsdom)
  packages/react/    @sb/editor-react — <Editor> wrapper (controlled + uncontrolled)
  packages/demo/     Vite demo: vanilla + React instances side by side, dark mode
```

Verified: `yarn test` 25/25 green, `tsc --noEmit` clean for core+react, `vite build` of demo succeeds, **Playwright e2e 7/7 green on chromium**. Firefox/webkit not yet run — verify locally with `yarn e2e`. Note: first e2e run exposed two page-object bugs (fixed): `Locator.dblclick()` aims at the element center not the word (use Range.getBoundingClientRect + mouse.dblclick), and Ctrl+A+Delete keeps the first block's tag so `clear()` must reset innerHTML to `<p><br></p>`. Demo/e2e port is **5177**.

Milestone 1 progress (§5): steps 1–6 DONE (alignment via text-align style, Indent/Outdent = padding on blocks / nest-unnest in lists with Tab/Shift-Tab, Enter-on-empty-li exits list, collapsed-cursor pending formats via U+FEFF caret containers — cleaned on input and in getContent). Verified: 41/41 unit, 12/12 chromium e2e (`e2e/lists.spec.ts` added). Step 7 basic sanitizer+paste done (needs Word fixtures); step 8 toolbar+statusbar done (NO menubar yet); steps 9–10 done.

**Milestone 1 COMPLETE + first M2 plugin.** Added since: `ui/Dialog.ts` (declarative modal, selection bookmark save/restore, focus trap, document-level Escape, testids dialog-*), `ui/Menubar.ts` (registry-driven via `ui.addMenuItem`, only non-empty menus render, platform-aware shortcut labels, testids menu-*/menuitem-*), `plugins/link.ts` (InsertLink dialog + args form, Unlink, autolink on space/Enter, Mod+K). Editor chrome now has a menubar (`menubar: false` to hide). Verified: 53/53 unit, 18/18 chromium e2e.

Hard-won e2e lessons (already fixed, don't regress):
- Toolbar must NOT refocus the editor after a command that opened a dialog (check `.sbe-dialog-overlay`).
- Dialog Escape must be a document-level capture listener — focus may be in the editor body.
- In specs, ALWAYS scope `menu-*`/`tb-*` locators via `editor.root.getByTestId(...)` — the demo page has two instances.

**M2 progress:** `plugins/table.ts` now has a combined grid picker + contextual table command center, InsertTable + row/column insert/delete, table/cell/row property dialogs, semantic header/body/footer rows, caption/striped styles, deterministic `<colgroup>` column resizing, a whole-table selection frame with width/height/corner drag handles, Table menu, Tab/Shift-Tab cell navigation, and Tab-on-last-cell row creation. The editor itself also has an optional statusbar height grip (`resize: false` disables it). `plugins/image.ts` (dialog src+alt, edit-in-place), `plugins/hr.ts`, `plugins/sourcecode.ts` (textarea dialog → setContent through sanitizer), `plugins/fullscreen.ts` (root class toggle, Esc exits, skipUndo). Dialog supports text, textarea, select, checkbox, responsive grid layouts, descriptions, hints, and an explicit close button. Toolbar supports dropdown panels (`dd-<name>` testid); panels preventDefault mousedown — clicking a panel must never steal the content selection (same rule as buttons). Verified: **78/78 unit tests, core+React TypeScript builds, 29/29 Chromium e2e**.

Known gaps / TODOs in code:
- `removeInline` drops nested formatting inside the extracted range (un-bolding `<strong><em>x</em></strong>` loses italics).
- Lists: no merging of adjacent lists; list toggle on headings drops the heading tag.
- Autolink regex is simple (no trailing-punctuation trimming).
- Table: no multi-cell selection or merge/split cells yet; row/column clipboard operations are also pending.
- Image: no resize handles or upload hook yet (URL only).
- Next (M2 remainder): search/replace, wordcount plugin, preview, visualblocks, paste-from-Word fixtures; then M3 inserts (charmap, emoticons, anchor, datetime, pagebreak, accordion).

## 4. Target architecture (summary — full detail in DESIGN.md)

- `Editor` facade: `Editor.init(config)`, `getContent()`, `setContent(html)`, `execCommand(name, args?)`, `queryCommandState(name)`, `on(event, cb)`, `destroy()`.
- Core modules in `packages/core/src/`:
  - `editor/Editor.ts` — lifecycle, config, plugin loading
  - `dom/SelectionManager.ts` — normalize/save/restore selection (bookmark = path indices + offsets)
  - `dom/DomUtils.ts` — inline toggle (split/merge text nodes), block transforms, wrap/unwrap
  - `model/Schema.ts` + `model/Sanitizer.ts` — whitelist schema; ALL inbound HTML (paste/setContent) goes through it
  - `commands/Registry.ts` — command registration/dispatch/state query
  - `undo/UndoManager.ts` — snapshots {html, selectionBookmark}, coalesce typing (~500ms or word boundary), cap ~100 levels
  - `events/Emitter.ts` — typed events: init, change, input, selectionchange, focus, blur, beforepaste, paste, keydown, execcommand, dirty
  - `ui/` — Toolbar (spec string: `"undo redo | bold italic | bullist numlist"`), Menubar, Dialog (declarative spec → form), ContextToolbar, Statusbar (element path + wordcount + resize grip)
  - `plugins/` — one folder per plugin implementing `{ name, init(editor) }`
- `packages/react/src/Editor.tsx` — wraps core; props: `value`/`onChange` (controlled) or `initialValue` (uncontrolled), `plugins`, `toolbar`, `menubar`, `onInit`; use refs to avoid re-init on re-render; `useEditor()` hook exposes instance.

## 5. Roadmap — exact next steps

**Step 0 (BLOCKING): get Sanoop's review verdict on DESIGN.md + mockup.html.** Ask what to change; apply; then proceed.

**Milestone 1 — working Phase-1 editor** (do in this order):
1. Scaffold monorepo: Yarn workspaces, Vite, TypeScript strict, Vitest + jsdom. Packages as in §2. Demo page in `packages/demo` loading the editor.
2. `Emitter`, `Editor` shell that attaches a contentEditable body inside chrome divs (menubar/toolbar/content/statusbar) — visually match mockup.html (reuse its CSS as the base theme, converted to core `ui/theme.css`).
3. `SelectionManager` + `DomUtils` + inline commands: Bold, Italic, Underline, Strikethrough, Sub/Superscript, Code, ForeColor, BackColor, RemoveFormat. Implement via Range splitting — NOT execCommand.
4. Block commands: FormatBlock (p, h1–h6, blockquote, pre), Justify*, Indent/Outdent.
5. `UndoManager` + keyboard shortcuts (⌘/Ctrl B/I/U/Z/⇧Z/K, Tab in lists).
6. `lists` plugin: ul/ol toggle, Tab/Shift-Tab nesting, Enter behavior in lists.
7. `Schema`/`Sanitizer` + paste pipeline (strip Word/GDocs junk; keep whitelist).
8. Toolbar/Menubar/Statusbar UI bound to command registry state (refresh on selectionchange, like mockup's `refresh()`).
9. React wrapper + demo showing SAME editor in vanilla and React side by side.
10. Tests per **TESTING.md** (authoritative): Vitest unit tests via the command seam, Playwright e2e with `getByTestId` locators only. Every UI element MUST carry a `data-testid` per the TESTING.md §4 registry.

**Milestone 2:** link+autolink, image (dialog + resize handles), media, table plugin (grid picker exists in mockup), code/codesample, searchreplace, fullscreen, preview, visualblocks/chars, wordcount.
**Milestone 3+:** charmap, emoticons, anchor, insertdatetime, nonbreaking, pagebreak, accordion, autosave, autoresize, directionality, quickbars, help, save. Then beyond-TinyMCE: markdown shortcuts, slash commands, mentions.

## 6. Conventions & gotchas

- Toolbar buttons must `preventDefault()` on **mousedown** to preserve the content selection (mockup demonstrates this).
- Save selection bookmark before opening any dialog; restore before executing its command.
- Coalesce undo snapshots during continuous typing; always snapshot before a command.
- Element path in statusbar = walk `anchorNode → editable root` (see mockup `refresh()`).
- All colors/spacing via CSS variables under `--` prefix; dark theme = `[data-theme="dark"]` overrides (see mockup for palette).
- Keyboard a11y: Alt+F9 menubar / Alt+F10 toolbar / Alt+F11 statusbar focus (TinyMCE convention), roving tabindex in toolbar, ARIA `role="toolbar"`, `aria-pressed` on toggles.
- Bundle budget: core + phase-1 plugins ≤ ~50 KB gzip.
- Work in this folder (the user's mounted workspace). Update THIS file's §3 "Current state" and check off roadmap items whenever you stop work.

## 7. Verification checklist before claiming a milestone done

- `yarn test` green; demo runs in `yarn dev`.
- Manual: type, select, bold, undo repeatedly across paragraphs; paste from Google Docs; nested list Tab/Shift-Tab; toolbar states track cursor.
- Both demos (vanilla + React) show identical behavior.

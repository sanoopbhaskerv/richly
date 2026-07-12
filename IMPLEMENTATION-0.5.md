# Implementation plan: 0.5.0 (text styles + image upload/resize)

**Basis:** DESIGN-0.5.md with all five §7 decisions applied.
**Structure:** seven PR-sized work packages, each independently green
(`yarn lint && yarn format && yarn test && yarn e2e --project=chromium`).
WP1–4 (text styles) and WP5–7 (images) are independent tracks.

## Decisions carried into this plan

1. Font sizes: `px` presets by default; `FontSize` accepts any CSS length
   verbatim, so hosts may configure `em`/`rem`/`%` values.
2. BackColor = `<span style="background-color: …">`.
3. Upload placeholders never enter the undo stack; snapshot on completion.
4. No upload progress events in 1.x; promise + spinner.
5. Default palette = 24-color matrix (3 rows × 8): light/soft, vibrant,
   dark/gray.

---

## WP1 — Styled-span engine (core, no UI)

**Files:** `dom/DomUtils.ts`, `__tests__/styled-span.test.ts` (new).

New exports:

```ts
/** Wrap the range in (or merge into) a span carrying `prop: value`. */
export function applyStyledSpan(range: Range, prop: string, value: string): Range;
/** Remove `prop` from the range, splitting any styled ancestor span. */
export function removeStyledSpan(range: Range, prop: string, root: HTMLElement): Range;
/** Nearest inline-style value for `prop` walking up to root ('' if none). */
export function queryStyledValue(node: Node | null, prop: string, root: HTMLElement): string;
/** True if el is a <span> whose only significance is inline styling. */
function isStyleSpan(el: Element): boolean;
```

Algorithm details (per DESIGN-0.5 §3):

- `applyStyledSpan`: extract contents → strip `prop` from descendant spans
  (unwrap spans left style-less) → if an ancestor `isStyleSpan` exactly spans
  the range, set `prop` on it (merge path); else wrap fragment in new span →
  merge with adjacent siblings whose full style set is identical → return
  range selecting the result.
- Style-set equality must NOT compare raw `cssText` (browsers serialize
  property order differently). Add `sameStyleSet(a, b)`: iterate each
  `CSSStyleDeclaration` by index, collect sorted
  `[prop, getPropertyValue(prop)]` pairs, compare pairs — order-, case- and
  whitespace-insensitive. Unit-test with two spans built in opposite
  property order.
- `removeStyledSpan`: mirror of `removeInline`'s left/mid/right ancestor
  split, but the mid copy only loses `prop`; spans left with no styles are
  unwrapped; empty left/right shells dropped.
- Collapsed-cursor path: extend `toggleInlineCollapsed`'s caret-container to
  accept a styled span factory. Extract the shared logic into
  `insertCaretContainer(editor, makeElement)` so tag toggles and style
  toggles reuse one implementation (internal refactor, no API change).
- Live-DOM cleanup: `Editor.cleanCaretFiller()` today only deletes the
  U+FEFF character. Extend it to also unwrap the caret container itself when
  it ends up empty after editing (type-then-delete), so empty styled spans
  never linger in the live DOM — `getContent()`'s clone pass remains the
  backstop, not the only defense.

**Unit tests (the matrix):** plain apply · re-apply same prop (replace, no
nesting) · subrange recolor (three-way split) · color+size coincide (single
span, invariant 2) · remove `prop` mid-span (split) · remove last prop
(unwrap) · adjacent-sibling merge · pending style then type · `RemoveFormat`
clears styled spans · sanitizer round-trip · `queryStyledValue` through
nested formatting (`<strong><span style=…>`).

**Done when:** matrix green; no invariant violated in any output
(`expect(html).not.toMatch(/<span[^>]*><span/)`, no `style=""`).

## WP2 — `queryCommandValue` + textstyle commands

**Files:** `commands/Registry.ts`, `editor/Editor.ts`, `plugins/textstyle.ts`
(new), `plugins/index.ts`, `index.ts` (exports),
`__tests__/textstyle.test.ts` (new).

- Registry: `Command.queryValue?(editor): string`;
  `CommandRegistry.queryCommandValue(name): string` (default `''`); facade
  method `Editor.queryCommandValue` mirroring `queryCommandState`.
- Config: `EditorConfig.textStyles?: { colors?: string[]; fontSizes?: string[] }`
  with defaults:

```ts
export const DEFAULT_FONT_SIZES = ['12px', '14px', '16px', '18px', '24px', '32px'];
export const DEFAULT_COLORS = [
  // light / soft
  '#fee2e2',
  '#ffedd5',
  '#fef9c3',
  '#dcfce7',
  '#cffafe',
  '#dbeafe',
  '#f3e8ff',
  '#ffffff',
  // vibrant
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#a855f7',
  '#ec4899',
  // dark / gray
  '#7f1d1d',
  '#9a3412',
  '#854d0e',
  '#14532d',
  '#1e3a8a',
  '#581c87',
  '#52525b',
  '#000000'
];
```

- Commands: `ForeColor { color }` / `BackColor { color }` (empty string ⇒
  remove), `FontSize { size }` (any CSS length, empty ⇒ remove),
  `Superscript` / `Subscript` (tag toggles with mutual exclusion — each first
  runs `removeInline` for the other), each with `queryState`/`queryValue`.
- All commands are no-ops without a range; collapsed ranges use the caret
  container from WP1.

**Unit tests:** command-level repeat of the WP1 matrix through `execCommand`,
mutual exclusion, `queryCommandValue` for color/size at various caret
positions, undo/redo across style changes, custom `fontSizes: ['1.2em']`
config honored verbatim (decision 1).

## WP3 — Text-style UI

**Files:** `ui/UiRegistry.ts` (no change expected), `ui/Toolbar.ts` (select
support if `tb-select-*` doesn't exist yet), `plugins/textstyle.ts`,
`ui/icons.ts` (+4 icons: forecolor, backcolor, superscript, subscript),
`ui/theme.css`, `editor/Editor.ts` (default toolbar spec), TESTING.md §4.

- Color panels via `ButtonSpec.panel`: 8×3 swatch grid (`role="grid"`,
  arrow-key navigation, Enter selects, Escape closes), "None" clear entry.
  Testids: `dd-forecolor`, `dd-backcolor`, `swatch-<hex-no-hash>`,
  `swatch-none`. Container click-transparent (inline-toolbar rule); swatch
  buttons `aria-label` with the color name.
- Toolbar select `tb-select-fontsize` bound to `FontSize` +
  `queryCommandValue` (refresh on `selectionchange` like toggle buttons);
  first option "Size" clears.
- Menubar: Format gains Superscript, Subscript, Font size entries (flat
  items per size — the menubar has no submenu support; acceptable).
- Default toolbar spec: `… strikethrough superscript subscript | forecolor
backcolor fontsize | …`.
- TESTING.md §4 rows for every new testid.

**E2E `text-style.spec.ts`:** swatch click colors selection · collapsed
color-then-type · re-color replaces (DOM has single span) · backcolor ·
font-size select round-trip incl. toolbar value tracking across caret moves ·
sub/sup exclusion via toolbar state.

## WP4 — Text-style hardening pass

- Clipboard fixtures: extend Word/GDocs fixtures with colored/sized text;
  sanitizer keeps `color`/`background-color`/`font-size`, drops the rest.
- `editing-edge-cases.test.ts` additions: styled span + bold interleaving,
  Enter inside styled span (browser splits it — assert no empty span leaks
  into `getContent`), RemoveFormat over mixed tag+style runs.
- Full three-browser e2e run for the text-style spec.

## WP5 — Image upload pipeline

**Files:** `editor/Editor.ts` (config), `plugins/image.ts`,
`plugins/clipboard.ts` (file paste/drop routing), `ui/theme.css` (spinner),
`__tests__/image-upload.test.ts` (new), TESTING.md.

- Config `images?: { upload?, accept = 'image/*', maxBytes? }`; events
  `imageuploadstart/end/error` added to `EditorEvents`.
- New internal `uploadAndInsert(editor, file)`:
  1. validate type/`maxBytes` → on failure emit `imageuploaderror`
     (`error: new RangeError(...)`), no DOM change;
  2. insert `<img src=objectURL data-rly-uploading alt="">` at caret;
  3. `await upload(file)`; resolve → set final `src`/`alt`, remove marker,
     revoke objectURL, **then** `undoManager.snapshot()` + `change`;
     reject → remove placeholder, revoke objectURL, emit error, no snapshot
     (decision 3). `URL.revokeObjectURL` runs on **every** exit path.
  4. Orphan guard: the user may delete the placeholder (or the editor may be
     destroyed) while the upload is in flight. Both settle handlers check
     `placeholder.isConnected`; when false they revoke the objectURL, skip
     all DOM work, and still emit the end/error event so hosts can reconcile.
     Unit test: delete placeholder mid-flight → resolve → no DOM change, URL
     revoked (spy on `revokeObjectURL`).
- Dialog: when `upload` configured, add `dialog-field-file` (type `file`,
  honoring `accept`). Dialog framework gains a `file` field type; the resolve
  type becomes `(Record<string, string> & { files?: Record<string, File> })` —
  string fields unchanged, `File` objects in a parallel dictionary.
  **Reserved key:** no text field may be named `files`; documented in the
  Dialog TSDoc and guarded by a dev-mode console warning.
- Paste/drop: in clipboard plugin, if `e.clipboardData/dataTransfer.files`
  contains images and `upload` exists, preventDefault and route each file to
  `uploadAndInsert`; without `upload`, behavior identical to 0.4.0.
- `getContent()` cleanup pass drops `[data-rly-uploading]` images; sanitizer
  strips the attribute on inbound HTML (never accept it from paste).

**Unit tests:** resolve path (final src, marker gone, snapshot count +1) ·
reject path (placeholder removed, error event, snapshot count unchanged) ·
maxBytes/type rejection · no-hook = no file field, paste of files falls
through · `getContent` excludes in-flight placeholder · undo after completion
removes the image entirely.

## WP6 — Image selection frame + resize

**Files:** `plugins/image.ts` (frame install, mirroring
`installTableSelection`), `ui/theme.css`, TESTING.md.

- Click on `<img>` selects it (range around node) and shows frame with
  corner handles (`image-resize-xy`, both corners) + side handles
  (`image-resize-x`, `image-resize-y`).
- Corner drag: aspect-locked from `naturalWidth/Height` (Shift = free);
  side drags one axis; min 24px; writes `width`/`height` **attributes**;
  `undoManager.snapshot()` on mousedown, `change` on mouseup; frame
  repositions on `change`/scroll/resize like the table frame.
- Keyboard: frame focusable (`tabIndex 0`, `aria-label "Resize image"`),
  arrows ±1px, Shift+arrows ±10px, Enter/Escape deselect — snapshot on first
  nudge of a burst (coalesce like typing).
- Focus containment: the arrow-key handler is attached to the **frame
  element only**, never the editor body, so caret navigation in text is
  untouched. Clicking the image moves focus to the frame (content selection
  bookmarked); Escape or clicking/typing in content hides the frame and
  restores content focus. Unit test: ArrowRight with caret in text moves the
  caret, not the image size; ArrowRight with frame focused resizes.
- Frame hidden while `data-rly-uploading` present.

**Unit tests:** attribute writes + clamping via synthesized mouse events
(jsdom pattern from the statusbar-grip test), keyboard nudges, aspect lock
math (pure helper `constrainSize(w, h, ratio, axis)` exported for tests).

## WP7 — Image e2e + release prep

- `e2e/image-upload.spec.ts`: demo wires a fake uploader (resolves after
  150 ms with a data URL; a `?fail` variant rejects) — spec covers picker
  upload success, failure cleanup, paste-driven upload via
  `page.evaluate(new ClipboardEvent…)` fallback if `setInputFiles` paste
  proves flaky, corner-drag aspect ratio, keyboard nudge, uploading state
  excluded from `getContent`.
- Fixture: `e2e/fixtures/pixel.png` (tiny checked-in PNG).
- CHANGELOG `Unreleased` entries per WP; `yarn release:prepare` → expect
  **0.5.0 (minor)**; release branch → PR → tag per RELEASING.md.

---

## Sequencing & sizing

| WP  | Depends on | Relative size | Risk                                   |
| --- | ---------- | ------------- | -------------------------------------- |
| 1   | —          | L             | span merge/split correctness           |
| 2   | 1          | M             | low                                    |
| 3   | 2          | M             | select-in-toolbar refresh wiring       |
| 4   | 3          | S             | browser Enter-split quirks             |
| 5   | —          | M             | dialog `file` field API shape          |
| 6   | 5          | M             | frame/selection interplay with editing |
| 7   | 5, 6       | S–M           | e2e flake on file inputs               |

Recommended order: WP1 → WP2 → WP5 (parallelizable with WP3) → WP3 → WP6 →
WP4 → WP7. Each WP lands as one conventional-commit PR through the protected
`main` flow.

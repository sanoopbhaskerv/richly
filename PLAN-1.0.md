# Implementation plan: road to 1.0.0

Execution plan for the six gate items in ROADMAP.md. `0.4.0` (the current
feature set) is already published to npm — the soak clock (item 4) has
started. Remaining work ships as:

| Release      | Contents                                                 | Gate items |
| ------------ | -------------------------------------------------------- | ---------- |
| `0.5.0`      | Formatting gap + image upload/resize                     | 1, 2       |
| `0.6.0`      | Plugin guide + find/replace polish + soak feedback fixes | 3, 5       |
| `1.0.0-rc.x` | API freeze, audits, migration doc → `1.0.0`              | 6          |

Item 4 (soak) is not a code deliverable — it runs from the published `0.4.0`
through the RC, with feedback folded into `0.5.0`/`0.6.0`.
Every item follows the house rules: commands own the logic, UI binds to
commands, data-testids per TESTING.md §4, unit + Playwright coverage, and a
CHANGELOG entry.

---

## 1. Common-formatting gap — `0.5.0`

New commands: `ForeColor { color }`, `BackColor { color }`, `Superscript`,
`Subscript`, `FontSize { size }`. All are inline formats, so the work splits
into engine, commands, and UI.

**Engine (`dom/DomUtils.ts`).** Today the inline engine toggles _tags_
(`strong`, `em`, …). Colors and font size need _styled spans_, so add:

- `applyStyledSpan(range, prop, value)` — wraps like `applyInline` but with
  `<span style="prop: value">`; merges nested spans that only set `prop`
  (re-coloring a colored selection must not stack spans).
- `removeStyledSpan(range, prop, root)` — mirror of `removeInline` including
  the split-the-ancestor case, keyed on style property instead of tag name.
- Extend the caret-container (pending format) mechanism so color/size chosen
  with a collapsed cursor applies to the next typed text — same U+FEFF
  approach `formats.ts` already uses, with a styled span as the container.

**Commands (`plugins/textstyle.ts`, new).**

- `ForeColor`/`BackColor`/`FontSize` apply/replace the style; an empty value
  removes it. `Superscript`/`Subscript` reuse `toggleInline` with the existing
  `sub`/`sup` tag aliases, and applying one removes the other.
- Add `queryCommandValue(name)` to `CommandRegistry` (additive API — needed so
  the toolbar can show the current color/size; returns e.g. `#e5484d` or
  `16px`). Export the type; document in the plugin guide.

**Config (public API — design carefully, this freezes at 1.0):**

```ts
textStyles?: {
  colors?: string[];      // swatch palette, default ~24 swatches
  fontSizes?: string[];   // default ['12px','14px','16px','18px','24px','32px']
}
```

**UI.** Swatch dropdown via the existing `ButtonSpec.panel` API (same pattern
as the table grid picker): testids `dd-forecolor`, `dd-backcolor`,
`swatch-<hex-no-hash>`, plus a "remove color" entry. Font size is a toolbar
select (`tb-select-fontsize`). Menu entries under Format. Default toolbar
gains `forecolor backcolor | fontsize` and `superscript subscript`.

**Sanitizer.** `color`, `background-color`, `font-size` are already
whitelisted; add round-trip tests proving styled output survives
`setContent(getContent())`.

**Tests.** Unit: apply/replace/remove for each style, nested combinations,
collapsed-cursor pending styles, sanitizer round-trip, `queryCommandValue`.
E2E (`text-style.spec.ts`): pick swatch → typed/selected text colored, toolbar
reflects state, sub/sup mutual exclusion, font-size select round-trip.

Estimate: the styled-span engine is the risky half (adjacent-span merging and
normalize interactions); budget it like the original inline engine, not like a
plugin.

## 2. Image upload hook + resize handles — `0.5.0`

**Public config (the 1.0-critical part):**

```ts
images?: {
  upload?: (file: File) => Promise<{ src: string; alt?: string }>;
  accept?: string;     // default 'image/*'
  maxBytes?: number;   // reject oversized files before calling upload
}
```

**Upload flow.** Image dialog gains a file picker alongside the URL field
(`dialog-field-file`); paste and drag-drop of image files route through the
same path via the clipboard plugin. Sequence: insert placeholder `<img>` with
a `data-rly-uploading` marker (spinner via CSS) → call `upload(file)` →
replace `src` on resolve; on reject remove the placeholder and emit an
`imageuploaderror` event (new typed event — additive). No `upload` configured
= file controls hidden, URL-only flow unchanged.

**Resize handles.** Reuse the table selection-frame pattern
(`installTableSelection`): clicking an image shows a frame with `xy` corner
handles (testids `image-resize-xy` etc.), drag writes `width`/`height`
attributes, corner drag preserves aspect ratio, minimum 24px. Undo snapshot
before drag, `change` on release — identical conventions to table resize.

**Tests.** Unit: upload success/failure/no-hook paths with a stubbed promise,
placeholder cleanup, maxBytes rejection. E2E: `setInputFiles` with a fixture
image against a demo-configured fake uploader; drag a corner handle and assert
dimensions + aspect ratio (chromium first, then the matrix).

## 3. Plugin authoring guide — `0.6.0`

- `docs/PLUGINS.md`: anatomy of a plugin (`{ name, init }`), command
  registration and the undo/`change` contract, UiRegistry (buttons, toggle
  buttons, panels, menu items), dialogs, typed events, selection utilities,
  CSS variables/theming, data-testid conventions, and what is public vs
  internal.
- Two worked examples in `examples/` (excluded from publishing):
  `highlight-plugin` (~30 lines: command + toggle button — the "hello world")
  and `word-goal-plugin` (statusbar integration + config + events — the
  realistic one). Both get unit tests so they can't rot.
- Verify `@richly/core` ships the `.d.ts` surface a plugin author needs
  (`Plugin`, `Command`, `ButtonSpec`, `EditorEvents`, dialog types); add an
  export-snapshot unit test asserting the public export list — this doubles as
  the 1.0 freeze tripwire (any accidental export change fails CI).
- Acceptance: someone who has never read core source can build the highlight
  plugin from the guide alone.

## 4. Real-world soak — already running (`0.4.0` is live)

- ✅ `0.4.0` published to npm via the release flow.
- Remaining: deploy the demo (vite build of `@richly/demo`) to GitHub Pages
  as the public playground; link it from README and the npm package pages.
- Remaining: GitHub issue templates (bug / API feedback) so soak feedback is
  structured.
- Exit criteria for the soak: ≥ one full release cycle (`0.4.0` → `0.6.0`),
  and zero open issues labeled `api-breaking`. API-affecting feedback lands in
  `0.5.0`/`0.6.0`; pure fixes may ship as `0.4.x` patches.

## 5. Find/replace polish — `0.6.0`

- Match counter in the dialog: "3 of 17" (`findreplace-count` testid),
  updating live as the query changes.
- Keyboard navigation: Enter = next match, Shift+Enter = previous, while the
  dialog is open; current match highlighted distinctly from other matches
  (CSS classes `rly-match` / `rly-match-current` on temporary marks, cleaned
  from `getContent()` like caret fillers).
- Replace All reports how many replacements were made.
- Tests: unit for count/navigation/wrap-around/mark cleanup; e2e extending the
  document-tools spec.

## 6. Release-candidate pass — `1.0.0-rc.x` → `1.0.0`

1. **API freeze review.** Diff the export-snapshot test, `EditorConfig`,
   command names/args, event payloads, CSS variables/classes, and the
   sanitizer whitelist against MIGRATING.md; fix anything you're not willing
   to support for the life of 1.x _now_.
2. **Full-matrix e2e** required on the release branch (all three browsers —
   already in the Release workflow) plus a manual smoke on real Safari.
3. **Accessibility audit** against ACCESSIBILITY.md: axe-core run over the
   demo (add `scripts/a11y-audit.mjs` using Playwright + axe), keyboard-only
   walkthrough of every dialog/menu/context toolbar, focus-trap checks.
4. **Docs sweep**: MIGRATING.md gains the "0.x → 1.0" section defining the
   frozen surface; README quick-start verified against the published package;
   CHANGELOG rolled by `yarn release:prepare`.
5. Tag `v1.0.0-rc.1`, publish under the `next` npm dist-tag, soak 1–2 weeks,
   then promote: `yarn release:prepare` → `v1.0.0`.

---

## Sequencing and dependencies

```
0.4.0 published ✅ (soak running) ──► demo site + issue templates
textstyle engine ──► textstyle UI ──┐
image upload API ──► resize handles ─┼──► 0.5.0
                                     │
plugin guide + examples ─────────────┼──► 0.6.0 ──► (soak feedback folded in)
find/replace polish ─────────────────┘
export-snapshot test ── any time, earlier is better ──► RC freeze review
```

The two `0.5.0` tracks are independent and can be built in either order; the
export-snapshot test should land with `0.5.0` so the freeze review has
history. Nothing in `0.6.0` blocks on `0.5.0` except palette/config docs in
the plugin guide.

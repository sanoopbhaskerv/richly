# Design review: 0.5.0 — text styles & image upload/resize

**Status:** awaiting review · **Scope:** gate items 1–2 of PLAN-1.0.md
**Reviewer decisions needed:** see §7 before implementation starts.

## 1. Scope and non-goals

In scope: `ForeColor`, `BackColor`, `FontSize`, `Superscript`, `Subscript`
commands with toolbar/menu UI; an image upload hook with placeholder flow;
image resize handles. Out of scope: font _family_, line-height UI, upload
progress bars, image cropping/rotation, and any breaking change to existing
commands.

## 2. Public API additions (frozen at 1.0 — the review-critical part)

```ts
interface EditorConfig {
  // …existing…
  textStyles?: {
    /** Swatch palette for fore/back color. Default: 24-color set (see §4). */
    colors?: string[];
    /** Font size choices. Default: ['12px','14px','16px','18px','24px','32px']. */
    fontSizes?: string[];
  };
  images?: {
    /** Enables file upload in the image dialog and on paste/drop. */
    upload?: (file: File) => Promise<{ src: string; alt?: string }>;
    /** Accept filter for the file picker. Default 'image/*'. */
    accept?: string;
    /** Files larger than this are rejected before upload is called. */
    maxBytes?: number;
  };
}

// CommandRegistry — additive
queryCommandValue(name: string): string; // '' when not applicable
// Command interface gains optional: queryValue?(editor): string

// EditorEvents — additive
imageuploadstart: { file: File };
imageuploadend: { file: File; src: string };
imageuploaderror: { file: File; error: unknown };
```

Notes for review:

- `upload` returns `{ src, alt? }` rather than a bare string so hosts can
  return CDN metadata later without a breaking change (we can add optional
  fields to the return object compatibly).
- `queryCommandValue` mirrors `queryCommandState` and is how the toolbar
  shows the active color/size; plugins get it for free.
- Rejected alternative: a global `Editor.upload` method — upload is
  image-specific today; a generic file pipeline can be added post-1.0 without
  conflict.

## 3. Styled-span engine (`dom/DomUtils.ts`)

### Data model invariants

1. Text-level styles live on `<span style="…">` only — never on semantic tags
   (`strong`, `a`, …), so toggling bold never destroys a color.
2. One span may carry multiple style props (`color` + `font-size` merge into
   a single span when their ranges coincide) — keeps HTML shallow.
3. Spans with no remaining style props are unwrapped immediately; `getContent`
   never emits `<span style="">`.

### Operations

`applyStyledSpan(range, prop, value)`:

1. Extract range contents (existing `applyInline` mechanics).
2. Inside the fragment, delete `prop` from any nested spans (unwrap spans
   left with no styles) — prevents stacking.
3. If the extraction point sits inside an ancestor span whose _entire_
   content equals the range, set `prop` on that ancestor instead (merge,
   invariant 2). Otherwise wrap the fragment in a new span.
4. Normalize: merge with adjacent sibling spans whose style set is identical.

`removeStyledSpan(range, prop, root)`: same shape as `removeInline` — strip
`prop` inside the selection, and when an ancestor span carries `prop`, split
it left/mid/right, removing `prop` from the mid copy only.

`queryStyledValue(node, prop, root)`: walk ancestors up to the editable root,
return the first inline `style[prop]` hit ('' otherwise). Deliberately reads
inline styles, not `getComputedStyle` — deterministic in jsdom and immune to
theme CSS.

### Worked examples

```html
<!-- apply color over plain text -->
<p>hello [world]</p>
→
<p>hello <span style="color:#e5484d">world</span></p>
<!-- re-color a subrange: split, no nesting -->
<p><span style="color:red">aa[bb]cc</span></p>
→
<p>
  <span style="color:red">aa</span><span style="color:blue">bb</span
  ><span style="color:red">cc</span>
</p>
<!-- size + color coincide: one span -->
<p><span style="color:red">[word]</span></p>
+ FontSize 18px →
<p><span style="color:red; font-size:18px">word</span></p>
```

### Collapsed cursor

Reuses the existing U+FEFF caret-container mechanism: the container is a
styled span; typing inherits the style; `getContent()` and the input cleanup
already strip fillers and empty wrappers (span is in the cleanup list).

### Interactions

- `RemoveFormat` already unwraps `span` — clears colors/sizes as expected.
- `Superscript`/`Subscript` are plain tag toggles (`sub`/`sup` aliases exist);
  executing one first runs `removeInline` for the other — mutual exclusion.
- Sanitizer: `color`, `background-color`, `font-size` already whitelisted; no
  schema change. Round-trip tests added.

## 4. Text-style UI

- Split-swatch dropdowns for fore/back color via `ButtonSpec.panel` (grid
  picker pattern): 8×3 palette, "None" entry to clear, testids
  `dd-forecolor`, `swatch-<hex>`, `swatch-none`. Panel is click-transparent
  container per the inline-toolbar rule; `role="grid"` with arrow-key
  navigation matching the toolbar's roving tabindex conventions.
- Font size: `tb-select-fontsize` toolbar select bound to
  `FontSize`/`queryCommandValue`, first option "Size" (unset).
- Menu: Format gains Superscript, Subscript, Text color ▸ (opens the panel),
  Highlight color ▸, Font size ▸.
- Default toolbar spec inserts `forecolor backcolor fontsize` after the
  inline-format group and `superscript subscript` inside it.
- Default palette: the 12 accent colors already used in the demo/theme plus
  grays — final list is a reviewer decision (§7).

## 5. Image upload + resize

### Upload state machine (per file)

```
pick/paste/drop → validate (accept, maxBytes)
  → insert <img src=<objectURL> data-rly-uploading> + emit imageuploadstart
  → await upload(file)
      resolve: swap src, drop marker + objectURL, emit imageuploadend, undo snapshot commits final state
      reject:  remove placeholder, revoke objectURL, emit imageuploaderror
```

- The local `URL.createObjectURL` preview means the user sees the image
  instantly; CSS dims `[data-rly-uploading]` and overlays a spinner.
- `getContent()` excludes placeholder images (same cleanup pass as caret
  fillers) so half-uploaded content can never be persisted by the host app.
- Undo: the snapshot is taken when the upload _resolves_ — undoing removes
  the completed image; there is intentionally no undo state where the
  placeholder exists.
- No `images.upload` configured → file picker/drop/paste-of-files disabled;
  URL flow byte-identical to 0.4.0.

### Resize frame

Clicking an image selects it and shows a frame (pattern copied from
`installTableSelection`): corner handles `image-resize-xy` (both corners),
side handles x/y. Corner drag preserves aspect ratio (Shift = free), writes
`width`/`height` _attributes_ (already sanitizer-whitelisted, survive
serialization better than styles in email/paste contexts), min 24px, undo
snapshot on mousedown, `change` on mouseup. Keyboard a11y: when the frame is
focused, arrow keys nudge ±1px (±10 with Shift), matching the accessibility
statement's "all commands keyboard-reachable" rule.

## 6. Test plan (delta)

- Unit: styled-span apply/re-apply/split/merge/clear matrix, invariant tests
  (no nested styled spans, no empty spans), pending-style typing, sub/sup
  exclusion, `queryCommandValue`, upload resolve/reject/no-hook/maxBytes,
  placeholder exclusion from `getContent`, resize attribute writes.
- E2E `text-style.spec.ts`: swatch → colored text, collapsed-cursor color then
  type, font-size select round-trip, toolbar value tracking.
- E2E `image-upload.spec.ts`: `setInputFiles` + demo fake uploader (success +
  simulated failure), drag corner handle asserting aspect ratio, keyboard
  nudge.

## 7. Open questions for the reviewer

> **DECIDED (Sanoop, 2026-07-12):** 1. px presets by default; any CSS unit
> accepted via config. 2. `<span style="background-color: …">`. 3. No
> placeholder states in undo; snapshot on completion only. 4. No progress
> events in 1.x. 5. 24-color matrix: light/soft, vibrant, dark/gray rows.
> Build details in IMPLEMENTATION-0.5.md.

1. **Palette**: accept the theme-derived 24-color default, or supply a brand
   palette now? (Pure config; changeable any time — lowest stakes.)
2. **BackColor element**: `<span style="background-color:…">` (proposed) vs
   semantic `<mark>`. `<mark>` is nicer HTML but collides with find/replace
   highlight marks and can't express arbitrary colors without styles anyway.
3. **Font size units**: px presets (proposed, predictable) vs em/rem
   (theme-relative). Affects serialized HTML, so this one is hard to change
   after 1.0.
4. **Upload placeholder in undo history**: proposed "no placeholder state in
   undo" — agree, or should undo be able to restore an in-flight upload?
5. **`imageuploadprogress`**: omitted (the `upload` callback owns transport,
   so progress belongs to the host). Confirm we're comfortable never having
   editor-level progress UI in 1.x without an additive event.

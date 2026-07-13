# Scalable toolbar redesign

Status: implemented; future extensions are explicitly marked  
Scope: core editor, React binding, demo, documentation, and tests  
Design references: grouped, progressively disclosed toolbars supplied with the feature request

## Outcome

Richly adopts the references' clarity without copying their density. The toolbar now uses predictable
editing groups, and only controls with genuine variants become menus or split buttons. Clipboard,
document, and insert actions remain independent so users do not have to decode repeated ellipsis
menus or find duplicate tools in multiple places.

This also makes the demo a stronger product story: a visitor can immediately see that Richly handles
document structure, typography, lists, paragraph layout, and rich inserts without confronting three
rows of undifferentiated icons.

## Delivered capability matrix

| Area                | Delivered behavior                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| Headings            | One Block style menu exposes Paragraph, H1-H6, Quote, and Preformatted                           |
| Alignment           | One Alignment menu exposes left, center, right, and justify                                      |
| Line height         | Configurable unitless choices apply to caret, single-block, and multi-block selections           |
| Bullet lists        | Split control supports disc, circle, square, and remove-list                                     |
| Numbered lists      | Split control supports decimal, alpha, Roman, leading-zero, and remove-list                      |
| Toolbar composition | `                                                                                                | `separates atomic groups;` |     | ` creates one intentional full-width divided row boundary |
| Dropdown foundation | Shared menu/split renderer owns keyboard navigation, focus restoration, ARIA, and selected state |
| Sanitized output    | `line-height` and allowlisted `list-style-type` values survive sanitized round trips             |

## Recommended information architecture

The demo's `standard` toolbar has two deliberate rows with one full-width divider. The second row is
not an accidental flex wrap: it is declared with `||`. Existing `more` and `sliding` modes ignore the
fixed row break and continue moving complete atomic groups responsively.

```text
[Undo Redo] | [Select all Copy Cut Paste] | [Block style v] |
[B I U S Sup Sub Clear] | [Search Preview Blocks Source Fullscreen]
──────────────────────────────────────────────────────────────────
[Text color Highlight Font size Line height v] |
[Bullets split-v Numbers split-v] | [Alignment v Outdent Indent] |
[Link Unlink Image Table]
```

The design deliberately uses a single **Block style** control. Separate “Paragraph” and “H2” selects,
as shown in one reference, describe the same document property and would create conflicting states.

### Group 1 — History

- Undo
- Redo

History stays first and never enters a feature dropdown. On constrained widths, its whole group may
move according to the selected toolbar mode.

### Group 2 — Document structure

One `blockstyle` menu shows a live label and check mark:

| Label        | HTML           | Initial availability |
| ------------ | -------------- | -------------------- |
| Paragraph    | `<p>`          | Default              |
| Heading 1-6  | `<h1>`-`<h6>`  | Default              |
| Quote        | `<blockquote>` | Default              |
| Preformatted | `<pre>`        | Default              |

The menu applies a block format to every selected leaf block, not only the selection start. “Title”
and “subtitle” are presentation concepts rather than universal HTML structures, so applications may
add them through configuration instead of Richly assigning ambiguous semantics.

### Group 3 — Inline text

Keep text formatting visible and unambiguous:

- Bold, italic, underline, and strikethrough
- Superscript and subscript
- Clear formatting

The optional `moretext` token remains available to custom compact toolbars, but the standard preset
does not hide existing text actions behind an ellipsis.

### Group 4 — Color and typography

- Text-color panel: existing palette, theme colors, custom color, and automatic/remove color
- Highlight panel: existing palette, theme colors, custom color, and remove highlight
- Font-size select: preserve the current configurable sizes
- `lineheight` menu with unitless values:

| UI label | Stored value                                |
| -------- | ------------------------------------------- |
| Normal   | remove the inline `line-height` declaration |
| 1.0      | `1`                                         |
| 1.15     | `1.15`                                      |
| 1.25     | `1.25`                                      |
| 1.5      | `1.5`                                       |
| 1.75     | `1.75`                                      |
| 2.0      | `2`                                         |
| 2.5      | `2.5`                                       |
| 3.0      | `3`                                         |

Unitless line height scales with font size, survives sanitized round trips, and behaves consistently
inside headings and list items. Applying it to a multi-block selection updates each selected block.

Font family remains a separately scoped future extension. If added, it should be an opt-in
`fontfamily` control rather than part of `standard`; product teams should not be forced into arbitrary
web-font choices or output that depends on unavailable fonts.

### Group 5 — Lists

Use two split buttons. Clicking the main area toggles the current/last-used list style; clicking the
chevron opens the variant menu. This preserves the speed of today's one-click list buttons.

**Bullet list (`bulliststyles`)**

| Choice                | CSS/behavior                                 | Phase   |
| --------------------- | -------------------------------------------- | ------- |
| Disc                  | `list-style-type: disc`                      | Initial |
| Circle                | `list-style-type: circle`                    | Initial |
| Square                | `list-style-type: square`                    | Initial |
| None / remove bullets | Convert selected list items to paragraphs    | Initial |
| Dash list             | Custom marker/list extension                 | Later   |
| Checklist             | Semantic checklist extension with item state | Later   |

**Numbered list (`numliststyles`)**

| Choice                       | CSS/behavior                              | Phase   |
| ---------------------------- | ----------------------------------------- | ------- |
| Decimal (1, 2, 3)            | `decimal`                                 | Initial |
| Lower alpha (a, b, c)        | `lower-alpha`                             | Initial |
| Upper alpha (A, B, C)        | `upper-alpha`                             | Initial |
| Lower Roman (i, ii, iii)     | `lower-roman`                             | Initial |
| Upper Roman (I, II, III)     | `upper-roman`                             | Initial |
| Leading zero (01, 02, 03)    | `decimal-leading-zero`                    | Initial |
| None / remove numbering      | Convert selected list items to paragraphs | Initial |
| Outline/multilevel numbering | Counter-style extension                   | Later   |

Dash, checklist, and outline styles should not be faked with ordinary `list-style-type`. They require
custom markers or semantic item state, keyboard rules, sanitizer decisions, and accessible output.
Treating them as later extensions keeps the initial HTML interoperable.

The style belongs on the owning `<ul>` or `<ol>`, never on a wrapper around `<li>` elements. Applying a
style across items in multiple lists updates each owning list and must preserve valid list structure.

### Group 6 — Paragraph layout

The `alignment` menu contains:

- Align left
- Align center
- Align right
- Justify

The button icon reflects the common state. A mixed multi-block selection shows no check mark and an
accessible “Mixed alignment” value. Outdent and indent remain adjacent, because they operate on both
lists and ordinary blocks.

### Group 7 — Insert and advanced tools

Keep link, unlink, image, and table visible in `standard`; horizontal rule remains in the Insert
menubar. The optional `insertmenu` token is for custom compact integrations and is not placed beside
duplicate visible insert buttons. The standard preset keeps document utilities as an independent
button group:

- Find and replace
- Preview
- Visual blocks
- Source code
- Fullscreen

Select All, Copy, Cut, and Paste remain visible in the standard toolbar as well as the Edit menu. Their
tooltips render platform-native shortcuts so the direct controls are useful without showing confusing
portable notation.

## Presets and customization

The current `toolbar` string remains the lowest-level, backward-compatible API. Add named presets as a
convenience, with an explicit toolbar string taking precedence:

| Preset      | Intended use                      | Groups                                                           |
| ----------- | --------------------------------- | ---------------------------------------------------------------- |
| `essential` | Comments, captions, compact forms | history, clipboard, inline basics, color, link, clear formatting |
| `standard`  | Default application editor        | the two-row authoring composition above                          |
| `complete`  | CMS and document authoring        | standard plus a direct horizontal-rule control                   |

Delivered public configuration:

```ts
interface EditorConfig {
  toolbar?: string;
  toolbarPreset?: 'essential' | 'standard' | 'complete';
  textStyles?: {
    colors?: string[];
    themeColors?: string[];
    fontSizes?: string[];
    lineHeights?: LineHeightOption[];
  };
  listStyles?: {
    bullets?: ListStyleOption[];
    numbers?: ListStyleOption[];
  };
}
```

Each line-height and list-style option has a stable `value` and localizable `label`. Core validates CSS
values against supported allowlists rather than accepting arbitrary markup. React forwards the same
`EditorConfig`, so the two integrations cannot drift.

New toolbar tokens include `blockstyle`, `moretext`, `lineheight`, `bulliststyles`, `numliststyles`,
`alignment`, `insertmenu`, and `moretools`. The standard preset uses only the controls that avoid
duplicate actions and vague groupings; optional menu tokens remain composable for custom compact
integrations. Existing tokens (`h1`, `alignleft`, `bullist`, and so on) stay supported through 1.x.

## UI primitives and behavior

`UiRegistry` exposes two declarative controls rather than constructing feature-specific DOM:

- `menu`: one trigger and a list of command-backed menu items
- `split`: a primary command plus a menu of command-backed variants

Menu items support label, icon, command, arguments, repeatable split choices, selected state, and
separators.
State continues to come from the command registry. String-valued style identifiers fit the current
`queryCommandValue` contract; no feature should inspect the document directly from toolbar code.

One shared menu renderer owns:

- outside-click and Escape dismissal;
- Arrow Up/Down, Home, End, Enter, and Space navigation;
- focus return to the trigger;
- `aria-haspopup="menu"`, `aria-expanded`, `role="menu"`, and appropriate checked state;
- compact panel sizing that does not leak width into toolbar rows;
- selection bookmarks so opening a menu cannot lose the content selection;
- deterministic test IDs (`tb-<name>`, `dd-<name>`, `menuitem-<name>-<value>`).

On touch, each target is at least 40 px. Tooltips show localized shortcut labels, never portable
notation such as `Mod+C`. Split-button halves have distinct accessible names.

## Command and document model

Add or extend commands at the editor layer:

```ts
FormatBlock({ tag });
LineHeight({ value }); // empty value removes the declaration
ApplyList({ kind: 'ul' | 'ol', style });
RemoveList();
```

`FormatBlock` and `LineHeight` operate on all selected leaf blocks. `ApplyList` handles three paths:
creating a list, changing `ul`/`ol`, and changing the owning list's style. When a selection crosses
multiple lists, update each list once. Preserve nested child lists, selection bookmarks, and undo as a
single transaction.

Sanitized output examples:

```html
<p style="line-height: 1.5">Readable paragraph</p>
<ul style="list-style-type: square">
  <li>Item</li>
</ul>
<ol style="list-style-type: lower-roman">
  <li>Item</li>
</ol>
```

Add `list-style-type` to the sanitizer style allowlist. No invalid structure such as
`<ul><span><li>...</li></span></ul>` may be produced or accepted as a command result.

## Delivery plan

### Phase 1 — Foundation and contracts (delivered)

1. Define exported option types and preset precedence in `Editor.ts`.
2. Add `menu` and `split` specs to `UiRegistry` with TSDoc and compatibility tests.
3. Extract choice rendering into `ChoiceControl.ts` so `Toolbar.ts` retains responsive composition.
4. Build keyboard, dismissal, focus-restoration, role, and selected-state tests.

Exit criteria: plugins can register a keyboard-accessible command menu without custom DOM, and all
existing toolbar specs render unchanged.

### Phase 2 — Structure, alignment, and line height (delivered)

1. Register H4-H6 and preformatted block options.
2. Make block transforms apply to every selected block in one undo transaction.
3. Register `blockstyle` and `alignment`; keep legacy buttons.
4. Implement block-level `LineHeight`, value querying, configured presets, and sanitizer round trips.

Exit criteria: H1-H6, paragraph, quote, preformatted, all four alignments, and line height work for a
caret, one block, and multi-block selections.

### Phase 3 — List variants (delivered)

1. Refactor today's list toggle into `ApplyList` and `RemoveList` operations.
2. Add standards-based bullet and numbered style descriptors.
3. Implement both split buttons with current/last-style primary actions.
4. Add `list-style-type` sanitization and invalid-wrapper regression coverage.

Exit criteria: every initial variant creates valid HTML, changes existing lists without duplicating
items, works across partial/multiple-list selections, preserves nesting, and undoes in one step.

### Phase 4 — Presets and responsive composition (delivered)

1. Add the three named presets while preserving explicit `toolbar` strings.
2. Opt the revamped demo into `standard` while preserving the legacy default for integrations that
   omit `toolbarPreset`.
3. Verify each logical group remains an atomic overflow unit in `wrap`, `more`, and `sliding` modes.
4. Add mixed-state visuals and compact-width labels/icons.

Exit criteria: 320 px through wide desktop layouts expose every configured control without clipping,
and toolbar order is consistent across all three modes.

### Phase 5 — Demo, docs, and release polish (delivered)

1. Update the revamped demo to use `standard` by default and offer preset switching.
2. Add interactive examples for H1-H6, justify, line height, and every list variant.
3. Document custom option configuration, emitted HTML, accessibility, and migration from legacy tokens.
4. Add the feature and compatibility notes to the changelog.

Exit criteria: the demo communicates the expanded capability without requiring the visitor to open
every menu, and vanilla/React examples produce identical output.

## Test matrix

| Layer         | Required coverage                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| Commands      | collapsed selection, single block, multi-block, mixed state, cross-list selection, nesting, undo/redo |
| DOM validity  | lists contain only permitted list children; no empty duplicate items; no wrapper spans around `<li>`  |
| Sanitizer     | every allowed value round-trips; unsupported properties/values are rejected or normalized             |
| Toolbar       | trigger state, selected item, split primary action, last-used style, preset precedence, legacy tokens |
| Accessibility | keyboard menu traversal, Escape, focus restoration, ARIA state, 200% zoom, touch target size          |
| Responsive    | `wrap`, `more`, and `sliding` at compact/tablet/desktop widths                                        |
| Browser       | Chromium, Firefox, and WebKit selection behavior                                                      |
| Integration   | vanilla and React configuration/output parity                                                         |

Important regressions include selecting all but the last list item, selections ending at block
boundaries, selecting items from adjacent lists, styling a nested list, and applying a different style
to an already styled list.

## Release boundary

Ship phases 1-5 together in the next release candidate so menus, reliable multi-block commands,
presets, documentation, and the marketing demo describe the same capability. Dash lists, checklists,
outline numbering, and font family remain separately scoped extensions rather than delaying the
standards-based toolbar upgrade.

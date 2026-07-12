# Implementation plan: inline text selection toolbar

**Goal:** show a floating inline toolbar when the user selects text inside the editor body, similar to the existing table inline toolbar but focused on text formatting.

## Scope

Initial inline actions:

- `Bold`
- `Italic`
- `Link`
- `H2`
- `H3`
- `Blockquote`

## Design constraints

1. Reuse the floating overlay pattern from the table inline toolbar rather than extending the main toolbar.
2. Show only for non-collapsed text selections that live inside the editor body.
3. Active commands must highlight in the inline toolbar using existing `queryCommandState` APIs.
4. Keep pointer interactions selection-safe via `mousedown.preventDefault()`.
5. Do not add color/font-size dropdowns in this pass.

## Files

- `packages/core/src/plugins/textselectiontoolbar.ts` (new)
- `packages/core/src/plugins/index.ts`
- `packages/core/src/plugins/blocks.ts`
- `packages/core/src/ui/icons.ts`
- `packages/core/src/ui/theme.css`
- `packages/core/src/__tests__/inline-text-toolbar.test.ts` (new)
- `e2e/inline-text-toolbar.spec.ts` (new)
- `TESTING.md`

## Work packages

### WP1 — command surface and block support

- Add `H3` block support in `blocks.ts`.
- Ensure inline toolbar actions can map 1:1 to already-registered commands:
  - `Bold`
  - `Italic`
  - `InsertLink`
  - `FormatBlock:h2`
  - `FormatBlock:h3`
  - `FormatBlock:blockquote`

### WP2 — floating text inline toolbar plugin

- Create `textselectiontoolbar.ts`.
- Render a floating toolbar appended to `editor.getRoot()`.
- Reuse the table inline toolbar positioning model:
  - center above selection by default
  - flip below when clipped
  - clamp horizontally inside editor root
- Show when:
  - selection exists
  - selection is not collapsed
  - selection text is not only whitespace
  - selection lives inside `editor.getBody()`
- Hide when:
  - selection collapses
  - selection leaves the editor
  - focus truly leaves editor + inline toolbar

### WP3 — active state refresh

- Refresh toolbar button active state on:
  - `selectionchange`
  - `change`
  - `execcommand`
- Highlight active buttons using a dedicated class consistent with toolbar active visuals.

### WP4 — styling and test ids

- Add floating toolbar styles in `theme.css` mirroring the table inline toolbar.
- Add a separate namespace:
  - `text-inline-toolbar`
  - `inline-text-action-<id>`
- Keep the container click-transparent and buttons pointer-active.

### WP5 — validation

Unit tests:

- toolbar shows on non-collapsed text selection
- toolbar hides on collapsed selection
- active state reflects selected formatted text
- clicking actions executes commands
- `H3` toggles and reports active state

E2E tests:

- selecting text shows toolbar
- bold/italic/link/h2/h3/blockquote actions work
- active styles highlight when selection is inside formatted text
- toolbar hides when clicking elsewhere
- toolbar flips/clamps near edge

## Done when

- text inline toolbar appears only for text selection, not table/image selection
- active formatting highlights correctly
- `H3` is supported end to end
- `yarn test`
- `yarn e2e --project=chromium e2e/inline-text-toolbar.spec.ts`
- `npx tsc --noEmit -p packages/core/tsconfig.json`
- `yarn lint && yarn format`

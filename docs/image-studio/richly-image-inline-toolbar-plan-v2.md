# Richly Image Inline Toolbar v2 — Nested Quick Editing Plan

## Purpose

Enhance the Richly image-selection experience with a compact, contextual toolbar modeled on the supplied references.

The toolbar has three states:

```text
ROOT
├── Transform
└── Adjust
```

The toolbar remains anchored to the selected image while its content changes.

This design complements, rather than replaces, the full Richly Image Studio.

- Simple, frequent actions happen inline.
- Complex editing launches Image Studio.
- Headless image operations are implemented through `@richly/plugin-image-editor` and `@richly/image-core`.
- `@richly/core` and `@richly/react` remain free of Image Studio dependencies.

---

# 1. Visual references

Store the supplied references as:

```text
docs/image-studio/visual-reference/richly-inline-toolbar/
├── inline-image-toolbar-main-reference.png
├── inline-image-toolbar-transform-reference.png
└── inline-image-toolbar-adjust-reference.png
```

Use them as the visual source of truth for:

- floating white surface;
- rounded corners;
- subtle border and shadow;
- bottom-centered pointer;
- icon spacing;
- toolbar density;
- mode label;
- back navigation;
- icon-only actions;
- selected-image anchoring.

Do not copy any third-party branding or proprietary icon artwork. Use Richly’s own icon system or internally owned SVGs with equivalent meaning.

---

# 2. Toolbar state model

Use an explicit state machine:

```ts
type ImageToolbarMode = 'root' | 'transform' | 'adjust';
```

Optional transient state:

```ts
type ImageToolbarOverlay =
  | { type: 'none' }
  | { type: 'alt' }
  | { type: 'alignment' }
  | { type: 'adjust-slider'; adjustment: ImageAdjustmentKind }
  | { type: 'busy'; action: string }
  | { type: 'error'; message: string };
```

Rules:

- Selecting a new image resets the toolbar to `root`.
- Escape closes the topmost popover first.
- Escape from a sub-toolbar returns to `root`.
- Escape from `root` returns focus to the selected image/editor and hides the toolbar.
- Toolbar state must not be stored in `@richly/image-core`.
- Toolbar mode belongs to `@richly/plugin-image-editor`.

---

# 3. Root toolbar

Recommended order:

```text
Align | Crop | Transform | Adjust | Edit Studio | Alt | Replace | More/Delete
```

Equivalent icon layout:

```text
┌──────────────────────────────────────────────────────────────┐
│ Align  Crop  Transform  Adjust  Studio  ALT  Replace  More  │
└──────────────────────────────────────────────────────────────┘
                         ▼
```

## 3.1 Align

Opens a small alignment menu:

- Inline
- Align left
- Align center
- Align right
- Break out / full width, only if Richly already supports it

Do not invent unsupported document markup.

## 3.2 Crop

Crop should open Image Studio directly in Crop mode:

```ts
openEditor({
  ...input,
  initialTool: 'crop'
});
```

Reason:

- Direct crop handles require canvas overlays and geometry.
- Reimplementing crop inside Richly would duplicate Image Studio.
- The inline toolbar should remain lightweight.

## 3.3 Transform

Morphs the toolbar into the Transform sub-toolbar.

## 3.4 Adjust

Morphs the toolbar into the Adjust sub-toolbar.

## 3.5 Edit Studio

Use a sparkle/magic-style icon matching Richly’s icon language.

Behavior:

```ts
openEditor({
  ...input,
  initialTool: 'adjust' // or last-used/default tool
});
```

Accessible name:

```text
Open Image Studio
```

This is the full editor entry point.

## 3.6 Alt

Opens an alt-text mini popover.

## 3.7 Replace

Reuses existing Richly image replacement/upload behavior.

## 3.8 More/Delete

Preferred:

- More menu contains image details, reset display size, quick metadata, and Delete.
- Delete can remain directly visible if the product prioritizes it.

Avoid a gear-with-X icon whose meaning is unclear. Use a normal overflow menu and a clearly labeled destructive action.

---

# 4. Transform sub-toolbar

Reference-style layout:

```text
┌──────────────────────────────────────────────────────────┐
│ Back   Transform:   Rotate L  Rotate R  Flip V  Flip H  Resize │
└──────────────────────────────────────────────────────────┘
                              ▼
```

Actions:

1. Back
2. Rotate left 90°
3. Rotate right 90°
4. Flip vertically
5. Flip horizontally
6. Resize / open Transform panel in Image Studio

## 4.1 Rotate

Use headless image-core operations.

Required behavior:

- Every click works.
- Rotate-right is never disabled after one use.
- Four rotate-right clicks yield 90°, 180°, 270°, and 0°/360°.
- Each completed click creates one Richly undo step.
- Busy state prevents duplicate concurrent persistence.
- The toolbar repositions after image dimensions change.

## 4.2 Flip

Use headless operations:

- Flip horizontal
- Flip vertical

Required:

- repeatable;
- two identical flips restore the prior orientation;
- one successful action equals one Richly undo step.

## 4.3 Resize

The resize icon should open Image Studio in Transform/Resize mode:

```ts
openEditor({
  ...input,
  initialTool: 'transform',
  initialPanel: 'resize'
});
```

Do not force width/height forms into the narrow toolbar.

## 4.4 Optional quick-fit actions

A later More menu may include:

- Original size
- Fit content width
- 50%
- 100%

These affect display sizing, not pixel processing, and should use Richly’s existing image sizing semantics.

---

# 5. Adjust sub-toolbar

Reference-style layout:

```text
┌──────────────────────────────────────────────────────────────────┐
│ Back  Adjust:  Brightness  Contrast  Saturation  Grayscale  More │
└──────────────────────────────────────────────────────────────────┘
                                ▼
```

Approved MVP adjustments:

- Brightness
- Contrast
- Saturation
- Grayscale

Do not add temperature, tint, highlights, shadows, vibrance, blur, sharpness, or filter presets unless they already exist in the approved image-core roadmap.

## 5.1 Adjustment interaction

Clicking an adjustment icon opens a compact slider popover below or above the toolbar:

```text
Brightness
[-100 ───────────── 0 ───────────── +100]
[Reset]                              [Apply]
```

Rules:

- Start a headless `ImageSession`.
- Slider movement updates a transient preview.
- Do not persist on every input event.
- Use one preview transaction for the entire slider interaction.
- Apply exports and persists once.
- Apply creates exactly one Richly undo step.
- Cancel restores the original image and creates no history.
- Switching to another adjustment either:
  - preserves the same temporary session and updates the draft; or
  - prompts Apply/Cancel if required by the lifecycle.
- Never leave a temporary object URL attached after cancel/destroy.

## 5.2 Grayscale

Grayscale may be:

- a toggle button; or
- a slider from 0–100.

Preferred first version:

```text
Grayscale toggle
```

The button exposes `aria-pressed`.

## 5.3 More adjustments

The last icon may open full Image Studio in Adjust mode:

```ts
openEditor({
  ...input,
  initialTool: 'adjust'
});
```

This keeps the inline toolbar constrained to frequent adjustments.

---

# 6. Preview architecture

Inline quick adjustments require a preview without mutating Richly history.

Recommended flow:

```text
selected image
→ resolve source
→ create ImageSession
→ preview operation
→ create temporary preview object URL
→ temporarily display preview
→ Apply:
     export
     → persist
     → revalidate target
     → one Richly snapshot
     → mutate persisted src/metadata
     → one change event
     → revoke preview URL
→ Cancel:
     restore original src
     → revoke preview URL
     → destroy session
     → no snapshot/change
```

Important:

- The temporary preview is UI state, not a committed Richly mutation.
- Mark it so existing mutation observers or autosave logic do not treat it as a document change.
- Prefer an overlay preview image or plugin-managed transient attribute rather than repeatedly mutating serializable editor HTML.
- If using the actual `<img>` `src` for preview is unavoidable, suppress editor change tracking and restore safely.

---

# 7. Async action behavior

For immediate headless actions such as Rotate or Flip:

```text
capture target
→ resolve source
→ execute operation
→ export
→ persist
→ revalidate target
→ one undo snapshot
→ mutate intended image
→ one change event
→ cleanup
```

During operation:

- replace selected action icon with spinner or progress state;
- disable conflicting actions;
- preserve toolbar dimensions to avoid layout jump;
- announce state through a polite live region;
- reject duplicate activation;
- allow abort when the editor/image is removed.

On failure:

- original image remains unchanged;
- no Richly snapshot;
- show retryable error;
- toolbar returns to usable state.

---

# 8. Positioning and pointer

The toolbar visual must match the references:

- white or theme-aware raised surface;
- subtle shadow;
- 10–12px radius;
- bottom-centered triangular pointer;
- pointer aligns toward selected image center where possible;
- when toolbar flips below the image, pointer flips to the top;
- toolbar remains clamped to editor bounds.

Use the existing text toolbar’s positioning behavior as the baseline, but anchor to:

```ts
selectedImage.getBoundingClientRect();
```

Reposition on:

- image selection;
- image load;
- Richly image resize;
- quick rotate/flip completion;
- editor scroll;
- root resize;
- window resize;
- toolbar mode change;
- popover open/close.

---

# 9. Theme behavior

The references use a light surface. Richly may support light and dark themes.

Required:

```text
Light:
white toolbar, dark icons, soft gray border

Dark:
dark elevated toolbar, light icons, subtle border
```

Do not hard-code white-only styling.

Use Richly theme tokens.

---

# 10. Responsive behavior

## Wide editor container

Use full root toolbar with all primary actions.

## Medium container

- icon-only actions;
- move Replace/Delete into More;
- preserve Edit Studio and Crop.

## Compact/mobile container

Use a bottom contextual bar:

```text
Edit | Crop | Transform | Adjust | More
```

Sub-toolbar replaces the bottom bar content:

```text
Back | Rotate L | Rotate R | Flip V | Flip H
```

Adjustment slider opens in a bottom sheet.

Use container width, not browser viewport width alone.

---

# 11. Accessibility

Toolbar:

- `role="toolbar"`
- `aria-label="Image actions"`
- icon-only buttons have names/tooltips
- roving `tabIndex`
- Left/Right navigation
- Home/End
- Enter/Space activates
- Escape navigates back/closes
- Alt+F10 focuses the toolbar

Sub-toolbar:

- label exposed to assistive technology:
  - `Transform image`
  - `Adjust image`
- Back button named:
  - `Back to image actions`

Busy:

- `aria-busy="true"`
- live messages:
  - `Rotating image`
  - `Saving image`
  - `Image updated`
  - `Image update failed`

Adjustment slider:

- semantic range input where possible;
- visible numeric value;
- accessible min/max/current value;
- keyboard steps;
- Apply and Cancel.

---

# 12. Recommended implementation components

Do not treat this as a mandatory file map. Preserve repository conventions.

Logical responsibilities:

```text
ImageInlineToolbarController
ImageInlineToolbarView
ImageToolbarPositioner
ImageToolbarKeyboardNavigation
ImageToolbarRootActions
ImageToolbarTransformActions
ImageToolbarAdjustActions
ImageAdjustmentPopover
ImageAltPopover
ImageAlignmentMenu
ImageQuickEditSession
ImageQuickEditCommit
```

`@richly/plugin-image-editor` owns these responsibilities.

Any extraction into `@richly/core` must be generic and image-agnostic, such as:

```text
ContextualToolbarPositioner
RovingToolbarNavigation
```

No image-core imports may enter `@richly/core`.

---

# 13. Configuration

Equivalent API:

```ts
interface RichlyImageInlineToolbarOptions {
  enabled?: boolean;

  rootActions?: Array<
    'align' | 'crop' | 'transform' | 'adjust' | 'studio' | 'alt' | 'replace' | 'more' | 'delete'
  >;

  quickTransform?: boolean;
  quickAdjust?: boolean;

  openEditor?: (
    input: RichlyImageEditorInput & {
      initialTool?: 'crop' | 'transform' | 'adjust';
      initialPanel?: 'resize';
    }
  ) => Promise<ImageStudioResult | null>;

  compactBreakpoint?: number;
}
```

Defaults:

```ts
{
  enabled: true,
  rootActions: [
    "align",
    "crop",
    "transform",
    "adjust",
    "studio",
    "alt",
    "replace",
    "more",
  ],
  quickTransform: true,
  quickAdjust: true,
  compactBreakpoint: 560,
}
```

---

# 14. E2E coverage

## Root toolbar

- select image;
- root toolbar appears;
- text toolbar closes;
- correct action order;
- tooltips and accessible names;
- toolbar clamps/flips;
- light/dark theme.

## Transform

- enter Transform;
- Back returns to root;
- rotate right four times;
- rotate left four times;
- flip horizontal twice;
- flip vertical twice;
- resize opens Image Studio Transform panel;
- undo/redo each action;
- toolbar follows changed dimensions.

## Adjust

- enter Adjust;
- open each approved slider;
- transient preview;
- Cancel creates no mutation/history;
- Apply creates one history entry;
- one slider drag creates one edit;
- grayscale toggle;
- open full Adjust studio;
- cleanup object URLs.

## Failure states

- source resolution failure;
- persistence failure;
- stale target;
- image removed;
- editor destroyed;
- repeated rapid clicks;
- abort.

## Responsive

- desktop floating root/sub-toolbars;
- medium overflow behavior;
- mobile bottom root/sub-toolbars;
- bottom-sheet slider;
- state preserved through width changes.

## Visual baselines

```text
richly-image-toolbar-root.png
richly-image-toolbar-transform.png
richly-image-toolbar-adjust.png
richly-image-toolbar-adjust-slider.png
richly-image-toolbar-flipped.png
richly-image-toolbar-busy.png
richly-image-toolbar-error.png
richly-image-toolbar-dark.png
richly-image-toolbar-mobile-root.png
richly-image-toolbar-mobile-transform.png
```

---

# 15. Acceptance criteria

- Main image toolbar closely follows the supplied root reference.
- Transform click morphs the toolbar into a labeled sub-toolbar with Back.
- Adjust click morphs the toolbar into a labeled sub-toolbar with Back.
- Rotate and Flip are implemented through headless image-core integration.
- Rotate remains repeatable.
- Adjust uses transient preview and commits once.
- Crop and complex Resize open Image Studio at the relevant tool.
- Edit Studio opens the full editor.
- Toolbar follows the image after geometry changes.
- Text and image contextual toolbars never overlap.
- Compact editors receive equivalent bottom controls.
- No image-processing code leaks into `@richly/core`.
- One successful quick action equals one Richly undo step.
- Cancel/failure creates no undo or mutation.
- Tests, E2E, Graphify, build, lint, format, and size checks pass.

---

# 16. Claude Code correction prompt

```text
Read and obey:

- AGENTS.md
- docs/image-studio/architecture.md
- docs/image-studio/ui-handoff.md
- docs/image-studio/ui-correction-spec.md
- docs/image-studio/richly-image-inline-toolbar-plan-v2.md

Use these references:

- docs/image-studio/visual-reference/richly-inline-toolbar/inline-image-toolbar-main-reference.png
- docs/image-studio/visual-reference/richly-inline-toolbar/inline-image-toolbar-transform-reference.png
- docs/image-studio/visual-reference/richly-inline-toolbar/inline-image-toolbar-adjust-reference.png

TASK

Implement the Richly selected-image contextual toolbar using the supplied
nested-toolbar references.

The toolbar must have three modes:

- root
- transform
- adjust

It remains anchored to the selected image while its content morphs between
modes.

Do not copy third-party branding or proprietary SVGs. Use Richly-owned icons
with equivalent semantics.

Do not add image-core or Image Studio dependencies to @richly/core or
@richly/react.

Implementation belongs primarily in @richly/plugin-image-editor.

FIRST: AUDIT

Run:

- git status --short
- git branch --show-current
- git log --oneline -15
- yarn graph:query "How does the Richly text inline toolbar position and navigate?"
- yarn graph:query "How are Richly images selected resized aligned replaced and deleted?"
- yarn graph:query "How does plugin-image-editor execute headless image-core operations and launch Image Studio?"

Inspect:

- text selection toolbar implementation and tests
- image plugin selection/resize behavior
- plugin-image-editor headless API
- openEditor full UI bridge
- undo/change semantics
- icons and theme tokens
- current demos and E2E

Record current capabilities and continue autonomously.

ROOT TOOLBAR

Implement:

- Align
- Crop
- Transform
- Adjust
- Open Image Studio
- Alt text
- Replace
- More/Delete

Match the supplied root reference for density, surface, pointer, icon spacing,
and selected-image anchoring.

Crop opens Image Studio with initialTool: "crop".

Open Image Studio launches the full editor.

TRANSFORM SUB-TOOLBAR

Clicking Transform morphs the toolbar to:

- Back
- visible label "Transform:"
- Rotate left
- Rotate right
- Flip vertical
- Flip horizontal
- Resize

Rotate and Flip use headless image-core operations.

Rotate must remain repeatable. Four rotate-right clicks must yield 90, 180,
270, and 0/360.

Resize opens Image Studio with:

- initialTool: "transform"
- initialPanel: "resize"

Each successful quick transform:

- persists before Richly mutation;
- revalidates the intended image;
- creates exactly one Richly undo snapshot;
- emits exactly one change event;
- restores/repositions the toolbar.

ADJUST SUB-TOOLBAR

Clicking Adjust morphs the toolbar to:

- Back
- visible label "Adjust:"
- Brightness
- Contrast
- Saturation
- Grayscale
- Open full Adjust Studio

Clicking Brightness, Contrast, or Saturation opens a compact slider popover.

Use a headless ImageSession for transient preview.

Do not persist on every slider input event.

Apply:

- export once;
- persist once;
- revalidate;
- one snapshot;
- one image mutation;
- one change event;
- cleanup.

Cancel:

- restore original preview;
- no Richly mutation;
- no snapshot;
- no change event;
- destroy temporary resources.

Grayscale may be an accessible toggle using the same transaction semantics.

POSITIONING

Anchor to selectedImage.getBoundingClientRect().

Match the references:

- raised rounded surface;
- subtle border/shadow;
- centered bottom pointer;
- pointer flips when toolbar appears below;
- clamp inside editor root.

Reposition after:

- selection;
- scroll;
- root resize;
- image resize/load;
- toolbar mode change;
- quick edit completion;
- popover open/close.

Use ResizeObserver, not polling.

SELECTION AND COEXISTENCE

- Image toolbar appears only for selected editable image.
- Text toolbar and image toolbar never overlap.
- Selecting text closes image toolbar.
- Selecting image closes text toolbar.
- New selected image resets mode to root.
- Escape closes popover, then returns sub-toolbar to root, then returns focus.
- Alt+F10 focuses the image toolbar.

RESPONSIVE

Wide:
- full floating root and sub-toolbars.

Medium:
- icon-only; move lower-priority actions into More.

Compact:
- bottom contextual action bar;
- root and sub-toolbar modes;
- adjustment slider in bottom sheet;
- safe-area support;
- 44px targets.

Use editor-container width rather than viewport alone.

ASYNC AND ERROR BEHAVIOR

For immediate quick actions:

capture target
→ resolve source
→ execute
→ export
→ persist
→ revalidate
→ one snapshot
→ mutate
→ one change
→ cleanup

On cancellation, abort, export failure, persistence failure, or stale target:

- no mutation;
- no snapshot;
- no change;
- original image remains;
- toolbar returns to usable state.

Prevent duplicate concurrent actions.

ARCHITECTURE

Keep @richly/core image-agnostic.

A generic contextual-toolbar positioning/keyboard helper may be extracted only
when it improves both text and image toolbars without adding image dependencies.

Do not create monolithic files.

Production TS/TSX preferred under 450 logical lines.
Automatically refactor above 550.
React components preferred under 240.

Add useful TSDoc and focused commentary for preview ownership, object URL
cleanup, positioning, target revalidation, persistence-before-mutation, and
undo timing.

DEMO

Update:

/image-studio/richly-integration

Demonstrate:

- text toolbar;
- root image toolbar;
- Transform toolbar;
- Adjust toolbar;
- quick rotate/flip;
- quick adjustment preview Apply/Cancel;
- Crop opening Studio;
- Resize opening Studio;
- full Studio action;
- Alt;
- Replace;
- Alignment;
- More/Delete;
- undo/redo;
- error/busy/stale target;
- compact layout.

TESTS

Add unit and Playwright coverage from the plan.

Required visual baselines:

- richly-image-toolbar-root.png
- richly-image-toolbar-transform.png
- richly-image-toolbar-adjust.png
- richly-image-toolbar-adjust-slider.png
- richly-image-toolbar-flipped.png
- richly-image-toolbar-busy.png
- richly-image-toolbar-error.png
- richly-image-toolbar-dark.png
- richly-image-toolbar-mobile-root.png
- richly-image-toolbar-mobile-transform.png

VALIDATION

Run:

- git diff --check
- yarn graph:update
- yarn graph:check
- yarn lint
- yarn format
- yarn test
- yarn build
- yarn size:check
- focused Richly image integration E2E
- yarn e2e

Review package dependencies, bundle sizes, visual screenshots, undo/change
ordering, object URL cleanup, Graphify changes, and file sizes.

Fix all confirmed issues.

COMMIT

Create one local commit:

feat(plugin-image-editor): add nested Richly image quick controls

Do not amend previous commits.
Do not push, merge, publish, or open a pull request.

FINAL REPORT

Report audit findings, toolbar modes, quick operations, full-Studio entry
points, preview lifecycle, undo/change evidence, responsive behavior,
accessibility, tests, visual baselines, bundle comparison, Graphify results,
commands/results, refactoring, limitations, commit hash, and final git status.

Begin now and continue autonomously.
```

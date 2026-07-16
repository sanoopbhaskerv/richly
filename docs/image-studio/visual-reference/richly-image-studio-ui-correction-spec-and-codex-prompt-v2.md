# Richly Image Studio — Screen-by-Screen UI Correction Specification

## Purpose

This document defines the corrective implementation required to bring the current Richly Image Studio UI and editing behavior into close visual and functional parity with the approved target design.

The current application has the general three-column structure, but several editing tools are still represented as basic forms rather than complete direct-manipulation editing experiences. The correction must address both:

1. **Visual parity** with the approved target UI.
2. **Functional completeness** for Crop, Resize, Rotate, Straighten, Flip, Adjust, Before/After, and Export.

The implementation must remain within the approved MVP architecture. The target reference contains future tools such as Draw, Text, Stickers, Frames, Filters, and AI Tools. These must not be implemented as working features in this correction. They may be rendered as disabled navigation items for visual parity, with a `Coming soon` tooltip and no command registration.

---

# 1. Visual references and precedence

Store the supplied images in the repository as:

```text
docs/image-studio/visual-reference/
├── screen-by-screen-target-reference.png
├── crop-detail-target-reference.png
└── current-implementation-baseline.png
```

Interpretation:

- `screen-by-screen-target-reference.png` is the **primary visual source of truth** for the complete editor. It defines the intended appearance and composition for:
  - Crop
  - Resize
  - Rotate & Straighten
  - Adjust
  - Before/After
  - Export
  - Desktop, tablet, and mobile layouts
  - Top toolbar and global controls

- `crop-detail-target-reference.png` is the **high-detail supplemental reference** for the Crop screen. Use it for:
  - crop frame proportions;
  - eight visible handles;
  - outside mask;
  - rule-of-thirds grid;
  - floating dimension toolbar;
  - aspect-ratio controls;
  - rotate, straighten, and flip grouping;
  - wide desktop panel proportions.

- `current-implementation-baseline.png` is the defect baseline and must not be used as a target.

Visual precedence:

1. Architecture and accessibility requirements
2. Screen-by-screen target reference
3. Crop detail reference for Crop-specific details
4. This written UI correction specification
5. Existing implementation preferences

Codex must not treat the screen-by-screen board as a loose inspiration. Each approved MVP screen must be compared to its corresponding panel in the board and corrected for structure, proportions, control grouping, spacing, iconography, and interaction model.

The target board includes some non-MVP labels or controls. Only the approved MVP capabilities in this document are functional requirements. Non-MVP tools may appear only as disabled visual placeholders when needed for shell parity.

Reference dimensions:

```text
Screen-by-screen design board: generated reference board
Crop detail reference:         2048 × 935
Current implementation:        2048 × 1116
```

The current implementation is too vertically loose, gives insufficient priority to the canvas, and uses incomplete form-based controls. The correction must address both layout and direct manipulation.

# 2. Global visual language

## 2.1 Desktop shell

At wide desktop sizes, the editor must use this structure:

```text
┌──────────────┬──────────────────────────────────┬───────────────────┐
│ Left tool    │                                  │ Right inspector   │
│ navigation   │         Main canvas              │                   │
│              │                                  │                   │
│              │                                  │                   │
│              │                                  │                   │
│              │         Filmstrip/footer         │                   │
└──────────────┴──────────────────────────────────┴───────────────────┘
```

Target proportions at approximately 2048px viewport width:

- Left tool rail: approximately `150–160px`
- Right inspector: approximately `430–470px`
- Center workspace: remaining width
- Filmstrip height: approximately `130–150px`
- Top application toolbar inside the workspace: approximately `58–64px`
- Outer corner radius: approximately `20–24px`
- Main shell should occupy most of the viewport with minimal dead space

The current implementation uses an oversized outer header and too much vertical space. Remove the separate “Standalone PWA host” banner from the primary editing view. Product and host metadata may exist on a launcher page, but the editor itself must open directly into the full-screen studio shell.

## 2.2 Color system

Use CSS variables and scoped `ris-*` classes.

Recommended target tokens:

```css
--ris-bg-app: #0d1015;
--ris-bg-shell: #11151b;
--ris-bg-rail: #15191f;
--ris-bg-panel: #171b21;
--ris-bg-control: #22272f;
--ris-bg-control-hover: #2a3039;
--ris-bg-control-active: #343b46;
--ris-canvas-bg: #0c1015;
--ris-canvas-pattern: rgba(255, 255, 255, 0.035);
--ris-border: rgba(255, 255, 255, 0.08);
--ris-border-strong: rgba(255, 255, 255, 0.16);
--ris-text: #f5f7fb;
--ris-text-muted: #aeb5c0;
--ris-text-subtle: #737b87;
--ris-accent: #8b4dff;
--ris-accent-hover: #9c67ff;
--ris-accent-soft: rgba(139, 77, 255, 0.18);
--ris-success: #6ed29a;
--ris-danger: #ff6b78;
--ris-focus: #b596ff;
```

## 2.3 Typography

Use the repository-approved UI font. Prefer:

```css
font-family:
  Inter,
  ui-sans-serif,
  system-ui,
  -apple-system,
  BlinkMacSystemFont,
  'Segoe UI',
  sans-serif;
```

Typical sizes:

- Tool rail label: `15–16px`, medium
- Inspector title: `18–20px`, semibold
- Section label: `14–16px`, semibold
- Body/control label: `13–15px`
- Numeric value: `13–15px`
- Primary action: `14–15px`, semibold

## 2.4 Control styling

All controls must follow the target design:

- Rounded rectangular controls with `8–12px` radius
- Dark raised surfaces
- Thin low-contrast borders
- Purple active state
- Clear hover and focus-visible states
- Minimum coarse-pointer hit target: `44 × 44px`
- Icon and label alignment must be consistent
- Numeric fields should align values centrally or to the right
- Sliders need a visible purple active track and high-contrast thumb

## 2.5 Iconography

Replace text-symbol placeholders such as:

```text
↶
↷
☼
#
□
↻
⇋
```

with a consistent icon system.

Use one existing icon package already approved by the repository, or small internal SVG components. Do not use emoji or Unicode symbols as production toolbar icons.

All icons must:

- share consistent stroke width;
- be visually centered;
- have accessible labels;
- support currentColor;
- not increase the default Richly core bundle.

---

# 3. Main editor shell screen

## 3.1 Top workspace toolbar

The toolbar sits above the canvas, not above the entire product page.

Left side:

- Product title or current image filename
- Optional unsaved-change indicator

Right side:

- Undo
- Redo
- Zoom out
- Current zoom percentage
- Zoom in
- Before
- Export
- Close

Behavior:

- Undo and redo are disabled only when history state requires it.
- Zoom controls operate repeatedly.
- Before supports press-and-hold and toggle behavior.
- Export opens the export screen.
- Close invokes host cancel/discard behavior.

## 3.2 Left tool navigation

Order:

1. Adjust
2. Filters — disabled, optional visual placeholder
3. Crop
4. Transform
5. Draw — disabled
6. Text — disabled
7. Stickers — disabled
8. Frames — disabled
9. AI Tools — disabled

MVP mapping:

- Resize, Rotate, Straighten, and Flip belong inside **Transform**.
- The current separate Resize, Rotate, and Flip rail entries must be consolidated.
- Crop remains a separate top-level tool.
- Active item uses a full purple background matching the target.
- Disabled future items remain visually present only when needed for target parity.

## 3.3 Canvas workspace

The center area must:

- use a subtle dark patterned or checker-like workspace background;
- center the image without excessive unused space;
- automatically fit the image to the available bounds;
- support zoom and pan;
- preserve tool and session state through responsive changes;
- render direct-manipulation overlays above the preview;
- keep interaction handles crisp at every zoom level.

## 3.4 Filmstrip

The target shows a bottom image filmstrip.

For MVP:

- Show the current image thumbnail selected with a purple outline.
- Allow additional images to be loaded into the local demo session.
- Include an add-image tile.
- Selecting another image changes the active local project image only after handling unsaved edits.
- This filmstrip belongs to the demo/standalone host state, not image-core.

When embedded through the Richly adapter, hosts may disable the filmstrip.

---

# 4. Crop screen specification

## 4.1 Screen composition

When Crop is selected:

- Crop tool rail item is active.
- A direct-manipulation crop frame appears over the image.
- A crop dimension toolbar floats above the crop frame.
- The right inspector title is `Crop & Straighten`.
- The right inspector includes:
  - Aspect Ratio
  - Rotate
  - Straighten
  - Flip
  - Reset
- Apply and Cancel should be available either in the floating crop toolbar or at the bottom of the inspector.
- The user must not have to click a separate `Start crop` button.

The current `Start crop` form-based workflow must be removed.

## 4.2 Crop overlay

The crop overlay must include:

- Four draggable corner handles
- Four draggable edge handles
- Full-frame drag to reposition the crop region
- Rule-of-thirds grid
- Dimmed mask outside the crop bounds
- Clear white crop border
- Pointer cursor changes for each handle
- Touch support with enlarged invisible hit areas
- Keyboard movement and resize support

Interaction behavior:

- Dragging inside the crop rectangle moves the crop region.
- Dragging an edge adjusts one side.
- Dragging a corner adjusts two sides.
- Crop coordinates remain clamped within the transformed image bounds.
- Aspect-ratio constraints are preserved during drag.
- Holding the documented modifier key temporarily changes or releases ratio behavior, if supported.
- Escape cancels the active crop draft.
- Enter applies the crop.
- Crop drag is transient and creates no history entry until Apply.
- Apply creates exactly one history entry.

## 4.3 Crop floating toolbar

Positioned above the crop frame.

Controls:

- Ratio selector
- Width field
- Height field
- Dimension lock
- Apply checkmark
- Optional cancel control

Behavior:

- Width and height show output crop dimensions in source-image pixels.
- Editing dimensions updates the crop frame.
- Lock preserves current ratio.
- The toolbar repositions to remain visible near viewport edges.
- On mobile it moves into the bottom sheet.

## 4.4 Aspect ratio inspector

Inspector controls:

- Custom dropdown
- Original
- Free
- 1:1
- 4:5
- 16:9
- 9:16
- 3:2
- 2:3

Behavior:

- The active ratio is visibly selected.
- `Original` uses the current transformed image ratio.
- `Free` removes ratio constraint.
- `Custom` permits custom width/height ratio.
- Changing ratio resizes the crop rectangle around its center where possible.
- The crop rectangle must never exceed image bounds.

## 4.5 Crop rotation

The target includes Rotate and Straighten in the Crop inspector.

### Rotate

Provide:

- Slider or stepped control
- Numeric value field
- Range suitable for broad rotation where approved
- Immediate transient preview

### Straighten

Provide:

- Fine-grained slider
- Numeric degree field
- Recommended range: `-45°` to `45°`
- Default `0°`
- Fine keyboard increments

During straightening:

- Image rotates beneath the crop frame.
- Crop frame remains valid.
- Empty corners must not leak into the final crop result.
- Preview remains responsive.

## 4.6 Flip within Crop

Provide two icon buttons:

- Flip horizontally
- Flip vertically

Each click must be repeatable.

Two horizontal flips restore the original horizontal orientation but remain valid separate commands unless transaction coalescing intentionally normalizes them.

## 4.7 Crop reset

Reset restores the current crop draft to:

- full transformed image bounds;
- current selected ratio behavior;
- rotate `0°`;
- straighten `0°`;
- no draft flips.

Reset should affect the current draft only until Apply.

## 4.8 Crop acceptance criteria

- Crop starts immediately when the tool is selected.
- User can drag all four corners.
- User can drag all four edges.
- User can move the crop frame.
- Grid and outside mask match the target visual hierarchy.
- Ratio options work.
- Width and height can be edited.
- Apply creates one history entry.
- Cancel creates no history entry.
- Crop remains usable at 320px width.
- Crop works with pointer, touch, and keyboard.
- Visual regression tests cover wide, tablet, and mobile crop states.

---

# 5. Resize screen specification

## 5.1 Location

Resize is inside the `Transform` inspector, not a separate rail item.

The Transform inspector should expose tabs or segmented controls:

```text
Resize | Rotate | Flip
```

Straighten may be available in Rotate or Crop depending on active workflow.

## 5.2 Resize controls

Provide:

- Width numeric input
- Height numeric input
- Lock aspect ratio control
- Unit selector:
  - Pixels
  - Percent
- Original dimensions display
- Resulting dimensions display
- Preset size options where useful
- Reset
- Apply
- Cancel

Optional quality control:

- `High quality`
- `Balanced`
- `Fast`

Do not expose implementation-specific resampling terminology unless helpful.

## 5.3 Resize interaction

Behavior:

- Width and height remain linked while lock is active.
- Unlock permits independent values.
- Percent mode resolves against the current output dimensions.
- Invalid, zero, negative, NaN, and excessive dimensions are rejected with inline validation.
- Changes remain transient until Apply.
- Apply creates one history entry.
- Cancel restores the previous committed state.
- Reopening Resize shows committed current dimensions.

## 5.4 Optional direct-resize frame

For close target parity, provide a direct canvas frame when Resize is active:

- Four corner handles
- Current pixel dimensions in a floating toolbar
- Dragging a corner updates width/height
- Aspect lock is respected
- Unlike Crop, the entire image bounds resize; no image content is removed

## 5.5 Resize acceptance criteria

- Width and height fields are fully functional.
- Lock behavior is correct.
- Repeated resize operations work.
- Undo restores the previous size.
- Redo reapplies it.
- Export dimensions match the resized result.
- Resize works on desktop, tablet, and mobile.
- No source-resolution mutation occurs before export.

---

# 6. Rotate, Straighten, and Flip screen specification

## 6.1 Transform inspector layout

Title:

```text
Transform
```

Sections:

1. Rotate
2. Straighten
3. Flip
4. Reset

## 6.2 Rotate 90° controls

Provide icon buttons:

- Rotate left 90°
- Rotate right 90°

These controls must work on every click.

Critical correction:

- Rotate right must not become permanently disabled after one rotation.
- Four consecutive rotate-right commands must produce `90°`, `180°`, `270°`, and `0°/360°`.
- Each click may create one history entry.
- Normalization may store angles modulo 360, but command availability remains unchanged.

The existing fixed/one-time rotate behavior is a defect.

## 6.3 Free rotation

Provide:

- Rotation slider
- Numeric degree input
- Reset-to-zero affordance

Recommended range:

```text
-180° to 180°
```

Behavior:

- Slider drag uses transient preview.
- Releasing or confirming creates one history entry.
- Numeric input updates preview.
- Arrow keys adjust values.
- No repeated history entries are generated during one slider drag.

## 6.4 Straighten

Provide a separate fine slider:

```text
-45° to 45°
```

Behavior:

- Straighten composes predictably with 90° rotation.
- The UI displays the actual current straightening angle.
- It is not silently reset when another Transform control is used.
- Reset clears rotation, straighten, and flip draft state for the current Transform draft.

## 6.5 Flip

Provide:

- Horizontal flip
- Vertical flip

Behavior:

- Buttons are toggle-like only when representing current draft state.
- Each activation must remain possible.
- Two identical flips restore the visual orientation.
- Undo and redo work correctly.

## 6.6 Transform acceptance criteria

- Rotate left works repeatedly.
- Rotate right works repeatedly.
- Free rotation works.
- Straighten works.
- Horizontal and vertical flip work repeatedly.
- Transform draft can be cancelled.
- Apply creates coherent history.
- Canvas overlay and image bounds remain centered.
- Export matches the transformed preview.

---

# 7. Adjust screen specification

## 7.1 Inspector layout

Title:

```text
Adjust
```

Sections:

- Light
- Color
- Effects, only where approved

Approved MVP controls:

- Brightness
- Contrast
- Saturation
- Grayscale

Suggested layout:

```text
Brightness      [slider] [  0 ]
Contrast        [slider] [  0 ]
Saturation      [slider] [  0 ]
Grayscale       [slider] [  0 ]
```

Each control includes:

- Label
- Slider
- Numeric value
- Optional per-control reset
- Accessible min/max/value semantics

## 7.2 Ranges

Recommended normalized UI ranges:

```text
Brightness: -100 to 100
Contrast:   -100 to 100
Saturation: -100 to 100
Grayscale:     0 to 100
```

Core may use normalized internal values, but the UI must consistently display the documented range.

## 7.3 Adjustment behavior

- Slider movement produces immediate transient preview.
- One pointer drag creates one history entry.
- Keyboard stepping follows the same transaction rule.
- Numeric input and slider remain synchronized.
- Reset all restores neutral values.
- Before/After temporarily shows the image before the current adjustment set.
- Adjustments persist when switching tools.
- Switching responsive layouts does not reset values.

## 7.4 Adjust acceptance criteria

- All four controls visibly change the image.
- Numeric value and slider remain synchronized.
- One drag equals one undo entry.
- Reset works.
- Undo and redo restore exact values.
- Export output matches preview.
- Controls are usable on touch devices.

---

# 8. Before/After screen specification

## 8.1 Toolbar button

The `Before` button exists in the top toolbar.

Support:

- Pointer press-and-hold:
  - pointer down shows original/baseline;
  - pointer up restores edited state.
- Keyboard press-and-hold:
  - Space or documented key while button focused.
- Click/tap toggle:
  - toggles before mode for touch accessibility.

The button must show a clear active state.

## 8.2 Comparison baseline

Default baseline:

- Original source image before current-session operations.

Optional future baseline:

- Previous committed state.

MVP must consistently use the original source unless architecture explicitly defines another baseline.

## 8.3 Visual behavior

Before mode:

- does not mutate history;
- does not clear the active tool;
- does not alter crop draft;
- does not affect export;
- remains responsive.

Optional split view may be added only if already approved. Do not delay the required press/toggle comparison to implement split view.

## 8.4 Before/After acceptance criteria

- Hold works with mouse.
- Toggle works with touch.
- Keyboard works.
- No history changes occur.
- Active tool and draft survive comparison.
- Original and edited states render at the same viewport transform.

---

# 9. Export screen specification

## 9.1 Presentation

Use a right-side export inspector or focused modal that matches the target visual system.

Title:

```text
Export
```

Sections:

1. Format
2. Quality
3. Dimensions
4. Background
5. Filename
6. Alt text, when relevant to the host workflow
7. Export summary
8. Primary action

## 9.2 Format controls

Formats:

- PNG
- JPEG
- WebP

Use segmented buttons or cards.

Behavior:

- PNG hides or disables lossy quality control.
- JPEG and WebP expose quality.
- Actual MIME type must be reported.
- Unsupported browser formats must be handled explicitly.

## 9.3 Quality

For JPEG/WebP:

- Slider
- Numeric percentage
- Recommended range: `1–100`
- Default chosen by product requirements
- Optional estimated size indicator

## 9.4 Dimensions

Show:

- Current output width
- Current output height
- Aspect lock
- Optional scale percentage
- Maximum-dimension warning
- Original source dimensions for context

Export-time resize must be clearly distinguished from committed Resize if both exist. Prefer committed Resize for MVP consistency.

## 9.5 Transparency/background

For JPEG:

- Show background color because JPEG cannot preserve alpha.
- Default to approved neutral color, typically white.

For PNG/WebP:

- Preserve transparency when supported.
- Background override may remain optional.

## 9.6 Filename

Provide:

- Filename field
- Extension synchronized with format
- Sanitization
- Suggested filename derived from the source

## 9.7 Export action

Primary button:

```text
Export image
```

During export:

- Disable duplicate submission.
- Show progress/busy state.
- Allow cancellation through AbortSignal when feasible.
- Do not mutate editor history.
- Return `ImageStudioResult`.
- Demo host provides a download action.
- Richly host persists first, then updates the document.

## 9.8 Export acceptance criteria

- PNG exports.
- JPEG exports.
- WebP exports when supported.
- Dimensions are correct.
- JPEG alpha is flattened correctly.
- Export can be cancelled.
- Repeated export works.
- Result metadata is correct.
- The editor remains usable after export.

---

# 10. Responsive tablet specification

## 10.1 Medium landscape

Recommended container range:

```text
768px–1199px
```

Layout:

- Compact icon-first left rail, approximately `64–72px`
- Center canvas takes priority
- Right inspector approximately `300–360px`
- Filmstrip remains visible when space permits
- Labels may collapse into tooltips
- Top toolbar remains one row where possible

## 10.2 Tablet portrait

At portrait widths:

- Left tool rail remains compact or becomes bottom navigation.
- Inspector becomes overlay drawer or bottom sheet.
- Canvas remains visible behind the inspector.
- Crop handles remain directly manipulable.
- Inspector can be dismissed without cancelling the tool.
- Layout changes do not recreate the session.

## 10.3 Tablet acceptance criteria

- No horizontal page overflow.
- All controls remain reachable.
- Crop frame remains draggable.
- Inspector does not permanently cover the full image.
- Filmstrip may collapse but must remain accessible.
- Touch targets are at least 44px.

---

# 11. Responsive mobile specification

## 11.1 Compact shell

Recommended compact threshold:

```text
below 768px container width
```

Structure:

```text
┌────────────────────────────┐
│ Compact top toolbar        │
├────────────────────────────┤
│                            │
│          Canvas            │
│                            │
├────────────────────────────┤
│ Bottom tool navigation     │
├────────────────────────────┤
│ Contextual bottom sheet    │
└────────────────────────────┘
```

## 11.2 Mobile top bar

Include:

- Back/close
- Undo
- Redo
- Before
- Export or Save

Zoom controls may move to a secondary overlay if space is limited.

## 11.3 Mobile tool navigation

Horizontally scrollable:

- Adjust
- Crop
- Transform
- Disabled future placeholders only when needed

Active tool uses purple emphasis.

## 11.4 Mobile contextual bottom sheet

The bottom sheet must:

- have a drag handle;
- support collapsed and expanded states;
- preserve the active tool while moving;
- respect safe-area insets;
- keep primary actions visible;
- allow sliders and numeric inputs;
- not block direct crop manipulation more than necessary.

For Crop:

- Ratio chips scroll horizontally.
- Width/height controls fit in one or two rows.
- Apply and Cancel remain sticky.
- The crop frame remains manipulable above the sheet.

## 11.5 Mobile canvas interactions

Support:

- One-finger crop handle drag
- One-finger crop frame move
- Two-finger pinch zoom
- Two-finger pan, or documented pan-mode behavior
- Prevention of accidental page scroll during canvas gestures
- Safe cancellation on pointer loss

## 11.6 Mobile acceptance criteria

Test at:

```text
390 × 844
360 × 800
320 × 568
```

Verify:

- No unintended horizontal page scrolling.
- Crop handles remain usable.
- Bottom sheet does not cover all image content.
- Slider controls work.
- Export controls fit.
- Keyboard focus is visible.
- Safe-area padding works.
- Session and history survive orientation/layout changes.

---

# 12. Accessibility specification

Required:

- Semantic buttons, inputs, labels, dialogs, and sliders
- `aria-label` for icon-only controls
- `aria-pressed` for toggle controls
- `aria-valuemin`, `aria-valuemax`, and `aria-valuenow` for custom sliders
- Focus trapping for modal export/host mode
- Focus restoration on close
- Keyboard crop manipulation
- Escape cancels transient tool state where appropriate
- Reduced-motion support
- Sufficient contrast
- No information conveyed only through color
- Disabled future tools expose `Coming soon`, not misleading interactive semantics

Keyboard baseline:

```text
Cmd/Ctrl+Z         Undo
Cmd/Ctrl+Shift+Z   Redo
Ctrl+Y             Alternate redo where supported
Enter              Apply active draft
Escape             Cancel active draft or close panel
0                  Fit image
1                  100% zoom
Arrow keys         Move/adjust focused direct-manipulation control
Shift+Arrow        Larger increment
```

Shortcuts must not trigger while typing into text or numeric fields unless explicitly intended.

---

# 13. Architecture and module correction strategy

Do not solve this by expanding one component.

Keep:

- `ImageStudio.tsx` as a thin composition root.
- Core document state in `@richly/image-core`.
- Viewport and interaction state in `@richly/image-react`.
- Shell, tool inspectors, responsive composition, export orchestration, and host behavior in `@richly/image-studio`.
- Demo-only sample images, filmstrip, local projects, PWA, and download behavior in `@richly/image-studio-demo`.

Recommended responsibility decomposition:

```text
packages/image-react/src/
├── canvas/
│   ├── ImageCanvas.tsx
│   ├── CanvasViewport.ts
│   └── interaction/
├── crop/
│   ├── CropOverlay.tsx
│   ├── CropGrid.tsx
│   ├── CropHandles.tsx
│   ├── cropGeometry.ts
│   └── useCropInteraction.ts
├── transform/
│   ├── useTransformDraft.ts
│   └── transformInteraction.ts
└── hooks/

packages/image-studio/src/
├── shell/
│   ├── StudioShell.tsx
│   ├── TopToolbar.tsx
│   ├── ToolRail.tsx
│   ├── CanvasWorkspace.tsx
│   ├── InspectorPanel.tsx
│   └── Filmstrip.tsx
├── tools/
│   ├── adjust/
│   ├── crop/
│   ├── transform/
│   └── export/
├── responsive/
│   ├── DesktopStudioLayout.tsx
│   ├── TabletStudioLayout.tsx
│   ├── MobileStudioLayout.tsx
│   └── ContextBottomSheet.tsx
├── controls/
│   ├── SliderField.tsx
│   ├── NumericField.tsx
│   ├── SegmentedControl.tsx
│   ├── IconButton.tsx
│   └── ToolButton.tsx
└── styles/
```

This is a responsibility map, not a required up-front file-count plan. Codex must adapt it to the current repository and avoid needless fragmentation.

File-size rules remain:

```text
Production TS/TSX preferred: 450 logical lines
Automatic refactor:          above 550 logical lines
React component preferred:   240 logical lines
```

When a file exceeds the automatic-refactor threshold, continue the task, extract cohesive responsibilities, rerun tests, and update Graphify.

---

# 14. Implementation sequence

## Stage 1 — Audit the current implementation

Codex must first inspect:

- current image-core operations;
- current crop operation and coordinate semantics;
- current React interaction hooks;
- current Studio shell;
- current demo;
- current Playwright tests;
- current screenshots;
- current phase commits.

It must explicitly identify:

- why crop is form-based rather than direct manipulation;
- why rotate-right stops working;
- whether resize is committed or only exported;
- whether straightening exists in core;
- whether one slider drag creates one history entry;
- where session recreation occurs during layout changes;
- whether the current shell adds the extra standalone host header.

Do not implement until this audit is complete.

## Stage 2 — Fix underlying command behavior

Before visual work:

- make rotate-left and rotate-right repeatable;
- normalize angle storage without disabling commands;
- confirm flip repeatability;
- complete straightening semantics;
- complete resize semantics;
- confirm crop geometry supports live draft updates;
- ensure previews are transient;
- ensure Apply creates one history entry;
- ensure Cancel creates none.

## Stage 3 — Build reusable direct-manipulation primitives

Implement:

- crop overlay;
- crop handles;
- crop move interaction;
- ratio-constrained geometry;
- keyboard geometry changes;
- transform sliders;
- reusable slider/numeric field;
- floating dimensions toolbar.

## Stage 4 — Rebuild the wide shell to match the target

Correct:

- extra host banner;
- dimensions and density;
- left rail;
- top toolbar;
- canvas proportions;
- right inspector;
- filmstrip;
- typography;
- iconography;
- surface styling.

## Stage 5 — Implement each tool screen

Order:

1. Crop
2. Transform
3. Resize
4. Adjust
5. Before/After
6. Export

Each screen must pass functional tests before the next is considered complete.

## Stage 6 — Implement responsive behavior

Build:

- wide desktop;
- medium landscape;
- tablet portrait;
- compact mobile;
- bottom sheet;
- safe areas;
- touch interactions.

Do not create separate duplicate desktop and mobile editors. Use one state model and adaptive composition.

## Stage 7 — Add visual-regression coverage

Create deterministic Playwright screenshot tests.

## Stage 8 — Final functional and visual review

Compare implementation screenshots with target reference and fix material differences before committing.

---

# 15. Visual-regression test specification

## Screen-to-reference mapping

Every screenshot baseline must be reviewed against the matching panel in
`screen-by-screen-target-reference.png`.

| Implementation screen       | Visual target                                   |
| --------------------------- | ----------------------------------------------- |
| Crop                        | Panel 1 plus `crop-detail-target-reference.png` |
| Resize                      | Panel 2                                         |
| Rotate & Straighten         | Panel 3                                         |
| Adjust                      | Panel 4                                         |
| Before/After                | Panel 5                                         |
| Export                      | Panel 6                                         |
| Responsive layouts          | Panel 7                                         |
| Top toolbar/global controls | Panel 8                                         |

Do not approve a baseline solely because it is internally consistent with the current application. It must also match the corresponding reference panel in:

- layout structure;
- relative dimensions;
- control grouping;
- panel density;
- typography scale;
- active-state treatment;
- icon sizing;
- canvas prominence;
- footer/filmstrip placement;
- responsive composition.

For each major screen, save a side-by-side review image or documented screenshot comparison in the task output before accepting the baseline.

## 15.1 Deterministic environment

For screenshot tests:

- Use one bundled deterministic landscape image matching the reference composition as closely as licensing permits.
- Use a second portrait image for compact behavior.
- Disable animations and transitions.
- Wait for fonts.
- Wait for canvas render completion.
- Use fixed device scale factor where supported.
- Use fixed test data.
- Do not rely on network resources.
- Hide timestamps and non-deterministic IDs.
- Use the same browser engine for approved baselines.

## 15.2 Required screenshot matrix

### Wide desktop — 1440 × 900

Capture:

```text
wide-adjust.png
wide-crop-default.png
wide-crop-custom-ratio.png
wide-crop-dragged.png
wide-transform.png
wide-resize.png
wide-before-active.png
wide-export.png
```

### Target-reference viewport — 2048 × 935

Capture:

```text
target-size-crop.png
```

This is the primary visual parity screenshot.

### Tablet landscape — 1024 × 768

Capture:

```text
tablet-landscape-crop.png
tablet-landscape-adjust.png
tablet-landscape-export.png
```

### Tablet portrait — 768 × 1024

Capture:

```text
tablet-portrait-crop.png
tablet-portrait-transform.png
```

### Mobile — 390 × 844

Capture:

```text
mobile-crop-sheet-collapsed.png
mobile-crop-sheet-expanded.png
mobile-adjust.png
mobile-export.png
```

### Minimum supported width — 320 × 568

Capture:

```text
mobile-320-crop.png
mobile-320-transform.png
```

## 15.3 Screenshot assertions

Recommended Playwright configuration:

```ts
expect(page).toHaveScreenshot('wide-crop-default.png', {
  animations: 'disabled',
  caret: 'hide',
  scale: 'css',
  threshold: 0.15,
  maxDiffPixelRatio: 0.005
});
```

For compact/mobile screenshots, allow at most:

```text
maxDiffPixelRatio: 0.01
```

Use tighter thresholds after baselines stabilize.

## 15.4 Structural visual assertions

In addition to screenshots, assert:

- left rail width range;
- right panel width range;
- image canvas occupies expected percentage;
- crop handles count equals eight;
- crop grid is visible;
- mask is visible;
- filmstrip is visible on wide layout;
- bottom navigation is visible on compact layout;
- right inspector is absent or converted on compact layout;
- minimum touch-target dimensions;
- no page-level horizontal overflow.

## 15.5 Visual parity review

Automated screenshot tests prevent regression but do not prove initial parity.

Before accepting the new baseline:

1. Capture the target-size crop screen.
2. Compare it side-by-side with `target-ui-reference.png`.
3. Review:
   - layout proportions;
   - surface colors;
   - spacing;
   - typography;
   - icon scale;
   - crop frame position;
   - crop mask;
   - grid;
   - floating toolbar;
   - inspector grouping;
   - filmstrip;
   - active tool treatment.
4. Do not approve the baseline while large structural differences remain.

---

# 16. Functional test matrix

## Crop

- Drag every corner.
- Drag every edge.
- Move frame.
- Change ratio.
- Enter width/height.
- Lock ratio.
- Rotate.
- Straighten.
- Flip.
- Reset.
- Cancel.
- Apply.
- Undo.
- Redo.

## Resize

- Change width.
- Change height.
- Lock.
- Unlock.
- Pixels.
- Percent.
- Invalid input.
- Apply.
- Cancel.
- Undo.
- Redo.

## Transform

- Rotate right four times.
- Rotate left four times.
- Alternate left/right.
- Free rotate.
- Straighten.
- Flip horizontal twice.
- Flip vertical twice.
- Apply.
- Cancel.
- Undo.
- Redo.

## Adjust

- Drag each slider.
- Enter numeric values.
- Reset one.
- Reset all.
- Confirm one drag equals one history entry.
- Switch tools and return.
- Undo.
- Redo.

## Before/After

- Pointer hold.
- Touch toggle.
- Keyboard hold.
- Switch while crop draft is active.
- Confirm no history mutation.

## Export

- PNG.
- JPEG.
- WebP.
- Quality.
- Filename.
- Dimensions.
- Alpha handling.
- Cancel.
- Repeated export.

---

# 17. Acceptance criteria

The correction is complete only when all of the following are true.

## Visual

- Wide Crop screen closely matches the approved target structure.
- Extra standalone host header is removed from the editor view.
- Left navigation matches target density and active state.
- Canvas receives the majority of workspace space.
- Right inspector matches target grouping and spacing.
- Crop frame includes border, eight handles, mask, and grid.
- Floating crop toolbar is present.
- Filmstrip matches target placement.
- Icons are consistent SVG/icon components.
- Tablet and mobile layouts are deliberate, not compressed desktop layouts.

## Functional

- Crop is fully direct-manipulation.
- Resize is complete.
- Rotate-left and rotate-right are repeatable.
- Straighten works.
- Horizontal and vertical flip work.
- Adjustments work and use transient previews.
- Before/After works without mutation.
- Export supports the approved formats and metadata.
- Undo and redo remain coherent.
- Repeated commands remain available.

## Architecture

- No Image Studio dependency enters `@richly/core` or `@richly/react`.
- Reusable packages do not register service workers.
- Direct-manipulation state remains in React/UI ownership.
- Persistent edit operations remain in image-core ownership.
- TSDoc and focused commentary are present.
- Files over 550 logical lines are automatically refactored.
- Graphify is updated.

## Testing

- Unit tests pass.
- Functional Playwright tests pass.
- Visual-regression tests pass.
- Existing Richly tests pass.
- Build, lint, formatting, size checks, and Graphify checks pass.

---

# 18. Required local commit

After all corrections, validation, screenshot review, and Graphify update, create one correction commit:

```text
fix(image-studio): complete editing interactions and match approved UI
```

Do not amend earlier phase commits.

Do not push, merge, publish, or open a pull request.

---

# 19. Precise Codex correction prompt

Paste the following into Codex from the repository root.

```text
Read and obey:

- AGENTS.md
- docs/image-studio/architecture.md
- docs/image-studio/ui-handoff.md
- docs/image-studio/ui-correction-spec.md

Use these visual references:

- docs/image-studio/visual-reference/screen-by-screen-target-reference.png
- docs/image-studio/visual-reference/crop-detail-target-reference.png
- docs/image-studio/visual-reference/current-implementation-baseline.png

The screen-by-screen target is the primary visual source of truth for every
approved MVP screen. The crop detail reference supplements the Crop panel.

The current Image Studio implementation is incomplete and does not yet match
the approved visual reference.

This is a corrective implementation task. Work autonomously on the current
local feature branch.

Do not push, merge, publish packages, open a pull request, change remotes, or
amend completed phase commits.

OBJECTIVE

Bring the current Image Studio into close visual and functional parity with
the approved screen-by-screen target UI.

The result must not be a superficial styling pass. Complete the missing direct
manipulation and command behavior.

SCREEN-BY-SCREEN VISUAL MATCHING

For every approved screen, use the matching numbered panel in
screen-by-screen-target-reference.png:

1. Crop
2. Resize
3. Rotate & Straighten
4. Adjust
5. Before/After
6. Export
7. Responsive layouts
8. Top toolbar and global controls

Match each panel's composition, density, spacing, hierarchy, inspector grouping,
canvas prominence, control styling, active states, iconography, and footer
placement as closely as practical.

Do not reuse one generic right-panel form for every tool. Each tool must have
the dedicated inspector and direct-manipulation behavior shown in its reference
panel.

Before accepting a visual baseline, compare the implementation screenshot
side-by-side with the corresponding target panel and fix material structural
differences.

FIRST: AUDIT

Before changing code:

1. Run:
   - git status --short
   - git branch --show-current
   - git log --oneline -12
   - yarn graph:query "How are crop resize rotate straighten flip adjust preview and export currently implemented?"

2. Inspect:
   - image-core commands and operations
   - image-react interaction state and overlays
   - image-studio shell and tool panels
   - image-studio-demo
   - current tests and screenshot coverage

3. Explain in the task log:
   - why Crop currently requires Start crop and lacks draggable handles
   - why rotate-right stops after one use
   - whether resize and straighten are functionally complete
   - whether adjustment drags create one history entry
   - why the shell differs from the visual target
   - which modules will be corrected

Do not ask for routine approval after the audit. Continue immediately.

FUNCTIONAL CORRECTIONS

Implement all behavior defined in ui-correction-spec.md, including:

1. Crop
   - starts immediately when selected
   - four draggable corner handles
   - four draggable edge handles
   - draggable crop interior
   - dimmed outside mask
   - rule-of-thirds grid
   - ratio constraints
   - editable pixel width and height
   - floating dimensions toolbar
   - pointer, touch, and keyboard interaction
   - Apply creates one history entry
   - Cancel creates none

2. Resize
   - width and height controls
   - aspect lock
   - pixels and percent
   - validation
   - Apply/Cancel
   - repeatable operations
   - correct undo/redo and export dimensions

3. Rotate, Straighten, and Flip
   - repeatable rotate left
   - repeatable rotate right
   - four rotate-right clicks produce 90, 180, 270, and 0/360
   - free rotation
   - fine straightening
   - repeatable horizontal and vertical flip
   - transient preview
   - coherent Apply/Cancel and history

4. Adjust
   - brightness
   - contrast
   - saturation
   - grayscale
   - synchronized slider and numeric input
   - one slider drag equals one history entry
   - per-control/reset-all behavior

5. Before/After
   - pointer hold
   - keyboard behavior
   - touch toggle
   - no history mutation
   - preserves active tool and draft

6. Export
   - PNG, JPEG, WebP
   - quality where applicable
   - correct dimensions
   - filename
   - alpha/background behavior
   - cancellation
   - repeated export
   - correct ImageStudioResult metadata

VISUAL CORRECTIONS

Match the approved screen-by-screen target composition as closely as practical.

Use dedicated visual implementations for:

- Crop screen matching panel 1
- Resize screen matching panel 2
- Rotate & Straighten screen matching panel 3
- Adjust screen matching panel 4
- Before/After screen matching panel 5
- Export screen matching panel 6
- Responsive layouts matching panel 7
- Top toolbar/global controls matching panel 8

Then apply these global corrections:

- remove the extra Standalone PWA host banner from the editor screen
- use the dense full-screen studio shell
- target-like left navigation
- canvas-first center area
- top workspace toolbar
- target-like right inspector
- bottom filmstrip
- target-like dark surfaces, borders, spacing, typography, purple accents
- replace Unicode symbols with consistent icons
- create the floating Crop dimensions toolbar
- match Crop & Straighten inspector grouping
- consolidate Resize, Rotate, Straighten, and Flip under Transform
- preserve disabled future tool placeholders only for visual parity
- do not implement Draw, Text, Stickers, Frames, Filters, or AI Tools

RESPONSIVE CORRECTIONS

Implement and test:

- wide desktop
- medium landscape
- tablet portrait
- mobile 390px
- mobile 320px
- compact top bar
- bottom tool navigation
- contextual bottom sheet
- safe-area support
- 44px coarse-pointer targets
- direct crop manipulation on touch
- no session recreation during layout changes
- no unintended page-level horizontal overflow

ARCHITECTURE

Preserve approved package boundaries.

Do not create monolithic components or stores.

ImageStudio.tsx must remain a thin composition root.

Production TypeScript/TSX preferred limit is 450 logical lines.
Above 550 logical lines, automatically refactor cohesive responsibilities,
rerun tests, update Graphify, and continue.

Add useful TSDoc to exported APIs and focused commentary for non-obvious
geometry, rendering, history, cancellation, cleanup, accessibility, and Richly
integration behavior.

TESTING

Add deterministic Playwright functional and visual-regression coverage defined
in ui-correction-spec.md.

Required visual viewport coverage:

- 2048x935 target crop screen
- 1440x900 wide
- 1024x768 tablet landscape
- 768x1024 tablet portrait
- 390x844 mobile
- 320x568 mobile

Use deterministic local sample images, disable animations, wait for fonts and
canvas stability, and store reviewed screenshot baselines.

Do not approve a visual baseline while large structural differences remain
between the implementation and the matching panel in
screen-by-screen-target-reference.png. Crop must also be compared against
crop-detail-target-reference.png.

Required functional checks include:

- drag every crop handle and crop interior
- aspect ratios
- crop Apply/Cancel
- resize lock/unlock
- rotate right four consecutive times
- rotate left four consecutive times
- straighten
- both flips twice
- one adjustment drag equals one history entry
- Before/After without history mutation
- all export formats
- responsive state preservation
- keyboard and touch behavior

VALIDATION

Before committing, run:

- git diff --check
- yarn graph:update
- yarn graph:check
- yarn lint
- yarn format
- yarn test
- yarn build
- yarn size:check
- all relevant Playwright functional tests
- all visual-regression tests
- yarn e2e

Review:

- git status --short
- git diff --stat
- git diff
- production file sizes
- Graphify changes
- generated screenshot diffs

Fix all confirmed issues.

COMMIT

Create one new commit only after validation:

fix(image-studio): complete editing interactions and match approved UI

Do not amend earlier phase commits.

FINAL REPORT

Report:

1. Root causes found
2. Functional corrections by tool
3. Visual corrections
4. Responsive corrections
5. Added and updated tests
6. Screenshot baseline list
7. Per-screen comparison evidence against panels 1–8
8. Visual-diff thresholds
9. Commands executed and results
10. Graphify update results
11. Files automatically refactored
12. Remaining known limitations
13. Commit hash
14. Exact command and route to run the corrected demo

Begin now and continue autonomously until the correction, review, validation,
and local commit are complete.
```

---

# 20. Manual sign-off checklist

After Codex completes:

```bash
yarn workspace @richly/image-studio-demo dev
```

Open the printed URL and verify:

## Crop

- Tool starts without `Start crop`.
- Eight handles are visible.
- Crop frame can move.
- Ratio presets work.
- Width/height toolbar works.
- Rotate and straighten preview correctly.
- Apply and Cancel work.

## Transform

- Rotate right four times.
- Rotate left four times.
- Straighten.
- Flip horizontally twice.
- Flip vertically twice.

## Adjust

- Drag every slider.
- Confirm one undo per drag.

## Before

- Hold with mouse.
- Toggle with touch emulation.
- Test keyboard.

## Export

- PNG.
- JPEG.
- WebP.
- Correct dimensions.

## Responsive

- 2048 × 935
- 1440 × 900
- 1024 × 768
- 768 × 1024
- 390 × 844
- 320 × 568

Do not accept the correction merely because tests pass. The target-size Crop screenshot must also be visually reviewed side-by-side with the approved target.

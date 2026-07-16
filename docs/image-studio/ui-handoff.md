# Richly Image Studio — UI Design Handoff and Code-Structure Guardrails

Status: Approved companion document  
Use with: `richly-image-studio-consolidated-approved-baseline.md`

This document tells Claude Code how to implement the approved Image Studio experience without drifting from the visual design or creating oversized, monolithic files.

---

## 1. When to give the UI design to Claude Code

### PR 1 — Package scaffolding

Provide:

- Consolidated approved architecture baseline
- This code-structure guardrail document

Do **not** ask Claude Code to implement the visual editor yet. PR 1 should create only package scaffolding, boundaries, build/test configuration, and empty public entry points.

### PR 5 — React primitives

Provide:

- Consolidated architecture baseline
- This document
- Relevant interaction sections of the visual design

Implement only reusable primitives:

- Provider and selectors
- Image canvas
- Crop overlay
- Viewport controls
- Accessible primitive controls

### PR 6 — Complete Image Studio UI

Provide all of the following:

- Consolidated architecture baseline
- This document
- The approved UI reference image
- Any later annotated screen specifications

At this phase, the visual design becomes an explicit acceptance input.

---

## 2. Design authority

Use this precedence when sources conflict:

1. Consolidated approved architecture baseline
2. Accessibility and responsive behavior requirements in this document
3. Annotated UI specifications
4. Visual mockup
5. Claude Code implementation preference

The visual mockup is a product-direction reference, not permission to compromise accessibility, package boundaries, responsiveness, or maintainability.

Do not infer unsupported MVP features merely because the mockup visually contains them. Examples such as drawing, stickers, text overlays, frames, and AI tools remain post-MVP unless separately approved.

---

## 3. Approved MVP information architecture

### Desktop

```text
ImageStudio
├── Top application bar
│   ├── Product/title
│   ├── Open or replace source
│   ├── Undo/redo
│   ├── Zoom controls
│   ├── Before/after
│   ├── Save/export
│   └── Close
├── Primary tool rail
│   ├── Adjust
│   ├── Crop
│   ├── Resize
│   ├── Rotate
│   └── Flip
├── Canvas workspace
│   ├── Image canvas
│   ├── Active tool overlay
│   └── Optional compact status
└── Context panel
    ├── Active tool title
    ├── Tool controls
    ├── Reset
    └── Apply/cancel when the tool has a draft
```

Desktop behavior:

- Canvas receives the largest available area.
- Tool rail remains compact.
- Context panel appears on the right.
- Export is a clearly differentiated primary action.
- History and zoom remain accessible without opening a context panel.

### Tablet

```text
Top application bar
Compact left tool rail
Canvas workspace
Narrow right context panel or overlay panel
```

Tablet behavior:

- Keep the canvas central.
- Collapse text labels when width is constrained.
- Context panel may overlay part of the workspace rather than reducing the canvas below a usable size.
- Controls remain touch-friendly.
- Landscape and portrait must both work.

### Mobile / installed PWA

```text
Compact top bar
Canvas workspace
Bottom tool navigation
Contextual bottom sheet
Primary save/export action
```

Mobile behavior:

- No permanent left or right rail.
- Tools are presented in a horizontally scrollable bottom navigation.
- The active tool opens a bottom sheet.
- The sheet supports collapsed, half-height, and expanded states where useful.
- Image remains visible while adjusting values.
- Apply/cancel actions remain reachable with one hand.
- Respect safe-area insets.
- Minimum primary touch target: 44 × 44 CSS pixels.
- Avoid hover-dependent interactions.
- Support pinch zoom and two-finger pan without blocking page-shell gestures unnecessarily.

---

## 4. Responsive implementation rules

Use container queries for the editor shell. Do not make the library depend only on viewport width because Image Studio may be embedded in a modal, drawer, dashboard panel, or Richly host.

Suggested layout categories:

```text
compact:  container width < 640px
medium:   640px–959px
wide:     >= 960px
```

These values are starting points and may be tuned through usability testing.

Rules:

- Use one component model with adaptive layout.
- Do not build unrelated `DesktopImageStudio` and `MobileImageStudio` copies.
- Responsive CSS may move the same controls between rail, panel, and bottom sheet.
- Preserve tool state when the container crosses a breakpoint.
- Never destroy and recreate the image session merely because layout changes.
- Use `ResizeObserver` through a focused layout hook.
- Respect `prefers-reduced-motion`.
- Ensure the editor remains usable at 320 CSS pixels wide.
- Ensure large desktop widths do not produce excessively wide tool panels.

---

## 5. PWA boundary

PWA behavior belongs to the standalone application package, not the reusable libraries.

Allowed in `@richly/image-studio-demo` or a future hosted app:

- Web app manifest
- Service worker
- Install prompt
- Offline shell
- Local project persistence
- Background or deferred synchronization
- File-handling and share-target integration when supported
- Offline and synchronization status UI

Not allowed in library packages:

- Automatic service-worker registration
- Global install-prompt listeners
- Host-application cache policy
- Assumptions about routes, origins, storage accounts, or cloud synchronization

The editor libraries should remain local-first and work while the host is offline, but the host application owns PWA lifecycle.

---

## 6. Visual and interaction rules

### Workspace

- Use a neutral dark workspace by default, with a supported light theme.
- Preserve strong contrast between the image, canvas background, controls, and overlays.
- Use checkerboard transparency only when the image contains or may produce alpha.
- Center images by default and provide Fit and 100% actions.
- Use subtle workspace chrome; the image is the primary visual object.

### Crop

- Show an outside dimming mask.
- Use clear corner and edge handles.
- Include an optional rule-of-thirds grid.
- Support mouse, touch, pen, and keyboard.
- Keep aspect-ratio presets in the contextual panel or mobile sheet.
- Apply and cancel must be explicit.
- Escape cancels the draft without creating history.

### Adjustments

- Each adjustment uses a labeled slider, numeric value, and reset affordance.
- Slider preview is transient.
- Pointer release or keyboard commit creates one history entry.
- Zero-value identity adjustments should not remain in the edit manifest.
- Provide an Auto action only after it has an approved deterministic implementation.

### History

- Undo/redo are always visible in desktop and compact top bars.
- A detailed history list is optional for MVP but the architecture must not prevent it.
- Operation labels must be understandable, not internal command identifiers.

### Export

- Save/export opens a focused flow with format, quality, dimensions, and alt text.
- Export progress and failure are accessible.
- Closing export returns to the same editing state.
- Image Studio returns a result; it does not upload unless the host persistence callback does so.

---

## 7. File-size and modularity policy

Claude Code must not create a single oversized `ImageStudio.tsx`, `useImageEditor.ts`, `styles.css`, or store file containing most of the product.

### Preferred limits

```text
Production TypeScript/TSX file:  <= 450 logical lines preferred
Production TypeScript/TSX file:  550 logical lines refactor threshold
React component:                 <= 240 logical lines preferred
Custom hook:                     <= 180 logical lines preferred
Function:                        <= 80 logical lines preferred
CSS component file:              <= 350 logical lines preferred
```

The 550-line threshold is not a hard stop. Claude Code should continue the task, but it must automatically refactor any production TypeScript or TSX file that grows beyond 550 logical lines, unless the file is generated code or a narrowly focused data/configuration module where splitting would reduce clarity.

Generated files, fixture data, and focused test tables may exceed these values when justified.

### Required decomposition rule

Split a file when two or more of these are true:

- It owns more than one product responsibility.
- It contains more than three substantial React components.
- It mixes state management, DOM interaction, rendering, and visual composition.
- It has more than one unrelated effect lifecycle.
- It contains breakpoint-specific duplicated component trees.
- It defines types used by multiple modules.
- It becomes difficult to test without rendering unrelated behavior.

### ESLint guardrails for new Image Studio packages

Add scoped overrides for the new packages rather than unexpectedly breaking the existing repository:

```js
{
  files: [
    "packages/image-*/src/**/*.{ts,tsx}",
    "packages/plugin-image-editor/src/**/*.{ts,tsx}"
  ],
  rules: {
    "max-lines": [
      "warn",
      {
        "max": 550,
        "skipBlankLines": true,
        "skipComments": true
      }
    ],
    "max-lines-per-function": [
      "warn",
      {
        "max": 120,
        "skipBlankLines": true,
        "skipComments": true,
        "IIFEs": true
      }
    ],
    "complexity": ["warn", 15],
    "max-depth": ["warn", 4]
  }
}
```

These rules should surface maintainability risks without blocking progress. When the warnings indicate that a production file exceeds the threshold, Claude Code should refactor it during the same task wherever practical.

Tests may use a separate, slightly higher limit when a data-driven test matrix is clearer than artificial fragmentation.

---

## 8. Approved UI package decomposition

```text
packages/image-studio/src/
├── index.ts
├── ImageStudio.tsx
├── controller/
│   ├── createImageStudioController.ts
│   ├── controllerStore.ts
│   ├── errors.ts
│   └── types.ts
├── host/
│   ├── ImageStudioHost.tsx
│   ├── ModalHost.tsx
│   ├── InlineHost.tsx
│   └── useDiscardConfirmation.ts
├── shell/
│   ├── StudioShell.tsx
│   ├── TopBar.tsx
│   ├── ToolRail.tsx
│   ├── BottomToolNav.tsx
│   ├── ContextPanel.tsx
│   ├── ContextBottomSheet.tsx
│   └── StudioFooter.tsx
├── workspace/
│   ├── StudioWorkspace.tsx
│   ├── CanvasStage.tsx
│   ├── CompareControl.tsx
│   ├── ZoomControls.tsx
│   └── WorkspaceStatus.tsx
├── tools/
│   ├── toolRegistry.ts
│   ├── adjust/
│   │   ├── AdjustPanel.tsx
│   │   ├── AdjustmentRow.tsx
│   │   └── adjustmentDefinitions.ts
│   ├── crop/
│   │   ├── CropPanel.tsx
│   │   ├── AspectRatioPresets.tsx
│   │   └── CropActions.tsx
│   ├── resize/
│   │   ├── ResizePanel.tsx
│   │   └── DimensionInputs.tsx
│   └── transform/
│       ├── RotateControls.tsx
│       └── FlipControls.tsx
├── export/
│   ├── ExportDialog.tsx
│   ├── ExportSettings.tsx
│   ├── AltTextField.tsx
│   └── useExportFlow.ts
├── state/
│   ├── createStudioUiStore.ts
│   ├── StudioUiProvider.tsx
│   ├── useStudioUiState.ts
│   └── selectors.ts
├── responsive/
│   ├── useStudioLayout.ts
│   ├── layoutCategories.ts
│   └── responsiveTypes.ts
├── a11y/
│   ├── FocusTrap.tsx
│   ├── LiveRegion.tsx
│   ├── RovingToolbar.tsx
│   └── useStudioShortcuts.ts
├── theme/
│   ├── ThemeScope.tsx
│   ├── tokens.ts
│   └── themeTypes.ts
├── i18n/
│   ├── defaultLabels.ts
│   └── labelTypes.ts
└── styles/
    ├── index.css
    ├── tokens.css
    ├── shell.css
    ├── workspace.css
    ├── panels.css
    ├── controls.css
    ├── dialog.css
    └── responsive.css
```

`ImageStudio.tsx` should be a thin composition root. It must not implement detailed tool logic.

Target shape:

```tsx
export function ImageStudio(props: ImageStudioProps) {
  return (
    <ImageEditorProvider {...providerProps}>
      <StudioUiProvider {...uiProps}>
        <ThemeScope theme={props.theme}>
          <StudioShell />
        </ThemeScope>
      </StudioUiProvider>
    </ImageEditorProvider>
  );
}
```

---

## 9. Styling rules

- Publish one public stylesheet entry: `@richly/image-studio/styles.css`.
- Internally compose that stylesheet from focused CSS files.
- Use `ris-` class prefixes and `--ris-*` custom properties.
- Do not use CSS-in-JS in MVP.
- Do not leak generic selectors such as `button`, `input`, or `.toolbar` globally.
- Scope all styles under the Image Studio root.
- Avoid inline pixel dimensions except for computed canvas/overlay geometry.
- Use logical CSS properties where practical.
- Support light, dark, and host token overrides.
- Keep responsive behavior primarily in CSS/container queries, not large conditional JSX trees.

---

## 10. Documentation and commentary requirements

All public APIs and non-trivial internal architecture must be documented.

### TSDoc requirements

Add TSDoc to:

- All exported functions, classes, interfaces, types, hooks, and React components
- Public props and configuration objects
- Public controller and session methods
- Extension points and plugin contracts
- Non-obvious generic types
- Error classes and error codes

TSDoc should explain:

- Purpose
- Parameters
- Return values
- Lifecycle and ownership
- Side effects
- Cancellation behavior
- Error conditions
- Threading or rendering assumptions
- Whether a value is controlled, uncontrolled, transient, serialized, or host-owned

Avoid low-value comments that merely repeat the symbol name or TypeScript type.

### Code commentary requirements

Add focused implementation commentary for:

- Complex geometry or coordinate transforms
- Crop and resize calculations
- Render-plan compilation
- Preview versus export behavior
- Undo/redo and transaction boundaries
- Async Richly integration and undo timing
- Resource disposal and object URL cleanup
- Browser compatibility fallbacks
- Accessibility behavior that may not be obvious from markup
- Performance optimizations and their invariants

Comments should explain **why** the code is structured a certain way, not narrate every statement.

### Auto-refactor behavior

Claude Code should monitor file growth while implementing.

When a production TypeScript or TSX file exceeds 550 logical lines, it should:

1. Continue the task rather than stop.
2. Identify separable responsibilities.
3. Extract cohesive components, hooks, utilities, types, or state modules.
4. Preserve public APIs and behavior.
5. Run the relevant tests after refactoring.
6. Report the refactoring in the final implementation summary.

Files between 450 and 550 lines should be reviewed for cohesion. Refactor them when they mix responsibilities or become difficult to test, but do not split them mechanically when a focused module is still clearer as one file.

## 11. UI implementation prompt addendum

Append this to the Claude Code prompt for PR 5 and PR 6:

```text
Follow the attached Richly Image Studio UI design handoff and code-structure
guardrails.

The approved design is responsive and canvas-first:
- Wide layout: left tool rail, central canvas, right contextual panel.
- Medium layout: compact rail and narrower or overlay contextual panel.
- Compact/mobile layout: top bar, central canvas, bottom tool navigation,
  contextual bottom sheet.
- Use container queries because Image Studio can be embedded in containers that
  are narrower than the browser viewport.
- Preserve session and tool state across layout changes.
- Respect safe-area insets and 44px coarse-pointer targets.
- PWA behavior belongs only to the standalone application.

Do not create a monolithic ImageStudio.tsx, state store, or stylesheet.
Use the approved module boundaries.
ImageStudio.tsx must remain a thin composition root.

Add TSDoc to all exported APIs and focused code commentary around non-obvious
architecture, rendering, history, accessibility, and integration logic.

Monitor file growth during implementation:
- 450 lines is the preferred production TypeScript/TSX limit.
- 550 lines triggers automatic refactoring.
- Do not stop the task when a file exceeds the threshold.
- Extract cohesive responsibilities, preserve behavior, rerun tests, and
  summarize the refactor in the final response.
```

---

## 12. UI acceptance gates

A UI phase is not complete until:

- Wide, medium, and compact layouts are demonstrated.
- Mobile layout uses bottom navigation and contextual sheets.
- Container resizing preserves the active session and tool.
- Keyboard-only crop and adjustment flows work.
- Touch targets meet compact-layout requirements.
- Focus returns correctly after modal closure.
- Reduced-motion behavior works.
- Themes use scoped tokens.
- No Image Studio code enters the default Richly bundles.
- PWA code exists only in the standalone application.
- Production files over 550 logical lines have been automatically reviewed and refactored where appropriate.
- Exported APIs have useful TSDoc.
- Complex implementation decisions include focused code commentary.

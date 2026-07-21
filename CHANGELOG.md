# Changelog

All notable changes to Richly are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and releases follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

#### Image Studio — new packages

- Added `@richly/image-core` package: framework-free image editing engine
  providing `ImageSession` (operation history, serialization), canvas-based
  rendering and export, and image adjustment channels (brightness, contrast,
  saturation, grayscale, sharpen). Includes built-in crop, resize, rotate, and
  flip operations with a typed `OperationRegistry` and transient adjustment
  previews so slider gestures update the canvas without committing to history.
- Added `@richly/image-react` package: React primitives over `@richly/image-core`
  — `ImageEditorProvider`, `useImageEditor` hook, `CropOverlay`,
  `CropOverlayParts`, `ImageSlider`, and `ImageToolbarButton`. Provides the
  direct-manipulation crop handle system and high-frequency gesture handling
  separated from core state subscription.
- Added `@richly/image-studio` package: full responsive React Image Studio UI
  shell with tool screens for Crop, Transform (rotate, straighten, flip), Adjust
  (brightness, contrast, saturation, grayscale with filter presets), Resize,
  Before/After comparison, and Export. Includes a Filmstrip for session history,
  a ContextPanel, a keyboard shortcut layer (Ctrl+Z/Y, 0 for fit, 1 for 100%),
  and an `ImageStudioController` for host-controlled modal lifecycle.
- Added `@richly/image-studio-demo` package: standalone PWA demo for Image
  Studio with offline-capable service worker, sample image, and integration
  reference for hosts.
- Added `@richly/image-ai-litert` package: optional on-device AI provider for
  Smart Enhance using LiteRT.js. Exposes `createLiteRtImageAiProvider()` and
  integrates with the Image Studio AI Tools panel to run local inference without
  a server round-trip.

#### plugin-image-editor — Richly integration

- Added `@richly/plugin-image-editor` package: bridges the text editor with Image
  Studio. Provides `imageEditorPlugin` (toolbar button, command integration) and
  `imageInlineToolbarPlugin` (floating toolbar that appears when an image is
  selected).
- Added `imageInlineToolbarPlugin` inline toolbar with configurable root actions
  (`align`, `crop`, `transform`, `adjust`, `studio`, `alt`, `replace`, `more`,
  `delete`), compact mobile layout, and escape-chain keyboard navigation.
  Quick edits (crop presets, rotate, flip, brightness/contrast/saturation/
  grayscale sliders) run entirely in-browser via `@richly/image-core` and commit
  as a single undoable change. Full Image Studio can be launched with an
  optional `openEditor` callback, keeping the bundle lazy-loadable.
- Added `enableStudioAction` option (default `true`) to
  `imageInlineToolbarPlugin`. Set to `false` to hide the root "Open Image Studio"
  button without removing `openEditor`; useful when the full Studio is available
  internally but should not be exposed to end-users.
- Added `enableAdjustStudio` option (default `true`) to
  `imageInlineToolbarPlugin`. Set to `false` to hide the "More adjustments in
  Image Studio" shortcut inside the Adjust sub-toolbar independently of the root
  studio action.
- Added an Image Studio integration fixture to the demo playground demonstrating
  host-side `openEditor` / `persist` callbacks and a modal container with full
  Image Studio shell.

### Fixed

- Fixed crop draft desync after Undo/Redo: the crop draft's frozen bounds were
  never resynced with the session's committed output size when it changed outside
  the draft, causing a subsequent drag/apply to silently mis-crop the real image.
- Fixed Resize panel "Percent" mode always displaying pixels instead of
  percentages.
- Fixed page overflow at 320 px width caused by a bare `1fr` grid track allowing
  the compact single-column layout to grow past the viewport; replaced with
  `minmax(0, 1fr)`.
- Fixed Before/After toolbar button toggle: `pointerup` was immediately resetting
  `compareMode` to `false` before the `click` handler flipped it back, leaving
  every click stuck in the active state. Replaced with a single duration-based
  handler (short press toggles, sustained press previews while held).
- Fixed demo host's post-export download link blocking a subsequent export by
  remaining fixed-positioned over the Export/Close controls; the link now
  auto-dismisses and exposes an explicit dismiss control.
- Fixed missing accessible name on the Crop aspect-ratio `<select>` (axe
  critical violation).
- Disabled offline caching in the Image Studio demo PWA during development to
  prevent stale asset serving.
- Fixed crop drag handles not responding in certain pointer configurations.
- Fixed crop draft alignment when the canvas coordinate system and the displayed
  overlay were out of sync.

### Tests

- Added unit tests for `enableStudioAction: false` and `enableAdjustStudio: false`
  flags verifying button absence and backwards-compatibility defaults.
- Added E2E Playwright tests in the demo playground for both new opt-out flags
  (root studio button hidden, Adjust sub-toolbar studio shortcut hidden).
- Added exploratory and monkey E2E coverage for Image Studio: shell, crop,
  transform, adjust, undo/redo, error resilience, and responsive layout at
  320 × 568, 390 × 844, and desktop widths.

## [1.0.0] - 2026-07-20

## [1.0.0-rc.9] - 2026-07-20

### Changed

- Demo app URL updated

## [1.0.0-rc.8] - 2026-07-14

### Fixed

- Prioritized textual clipboard payloads (`text/html` / `text/plain`) over
  image-file clipboard payloads during paste, so content copied from Word and
  similar editors pastes as document content instead of being routed through
  the image upload pipeline.

## [1.0.0-rc.7] - 2026-07-14

### Fixed

- Made table contextual menu entrance animation opacity-only (no translate/scale)
  so first-click actions remain reliable while the menu is opening under load.
- Removed temporary debug console output emitted during table context actions.

## [1.0.0-rc.6] - 2026-07-14

### Fixed

- Restored deterministic Home/End navigation inside the current block and
  Mod+Home/End navigation to the first or last leaf block.
- Normalized fully deleted documents to one empty paragraph instead of keeping
  orphan block containers such as an empty `<ul>`.
- Removed empty inline wrappers left at multi-block formatting boundaries and
  made Clear formatting peel styled spans such as custom font sizes.
- Closed pointer-opened toolbar choice menus on Escape and restored focus to
  their triggers, even when focus remained in the editor.
- Kept the floating More tools panel within the viewport by flipping it above
  its trigger or constraining it to an internally scrollable height.
- Contained narrow menubars by wrapping menu buttons without clipping their
  dropdown panels.
- Serialized native copy and cut events from Richly's clean selection fragment
  so same-editor paste no longer imports browser-computed style noise.
- Fixed inline formatting (Bold, Italic, Underline, Strikethrough) and link
  insertion across a multi-block selection. They previously wrapped the whole
  cross-block fragment in one inline element — nesting block elements inside an
  inline tag and corrupting the document (e.g. a stray empty `<li>`). Each
  block's slice is now formatted independently via the shared
  `inlineRangesForBlocks` path already used by the color/font-size commands.

## [1.0.0-rc.5] - 2026-07-14

### Added

- Added accessible, command-backed toolbar menu and split-button controls with
  shared keyboard navigation, focus restoration, selected-state reporting, and
  plugin-facing TypeScript/TSDoc contracts.
- Added `essential`, `standard`, and `complete` toolbar presets. Explicit
  toolbar strings continue to take precedence, and integrations that omit a
  preset retain the release-candidate default toolbar for compatibility.
- Added a grouped standard authoring toolbar with explicit row composition and
  full-width row dividers. Select All, Copy, Cut, Paste, superscript,
  subscript, clear formatting, search, preview, visual blocks, source, and
  fullscreen remain independent first-class controls without duplicating
  visible insert actions in dropdowns.
- Added a Block style menu covering Paragraph, H1–H6, Quote, and Preformatted;
  a complete alignment menu including Justify; configurable unitless line
  heights; and split bullet/numbered-list controls with portable marker styles.
- Added `toolbarPreset`, `textStyles.lineHeights`, and `listStyles`
  configuration to core and React, plus the corresponding public option types.
- Added visual marker previews to bullet and numbered-list menus.
- Added public `applyInlineStyle` and `getInlineStyleValue` helpers so custom
  plugins can reuse Richly's list-safe selection, caret, cleanup, and state
  behavior.
- Added the atomic timestamp plugin to the Live product preview and custom
  React demo, while retaining the highlight plugin as a distinct, visible
  highlighter action beside the built-in background-color control.

### Changed

- Minified the published core ESM and CommonJS builds and added enforced gzip
  budgets for both JavaScript formats and the complete editor theme.
- Updated the demo's live product preview to use the grouped `standard` preset
  and document the expanded structure, spacing, alignment, and list features.
- Extracted choice-menu rendering from the main toolbar renderer to keep
  responsive layout code and accessible popup behavior independently scoped.
- Refactored the toolbar into a stable coordinator with focused rendering,
  panel, command-state, keyboard, measurement, overflow, and sliding modules.
  The public constructor, toolbar specifications, DOM contract, accessibility
  behavior, and responsive selection preservation remain unchanged.

### Fixed

- Kept every fully applied inline-format toggle active after sequential Bold,
  Italic, Underline, or Strikethrough commands on the same multi-block
  selection. State queries now evaluate every block-local selection slice.
- Preserved valid list ownership and nesting while changing list kind or marker
  style; commands never wrap `<li>` elements in spans or add empty items.
- Prevented menu panel sizing from leaking into toolbar controls and causing
  horizontal overflow at compact breakpoints.
- Fixed image width resizing when pasted inline CSS overrode width/height
  attributes. Resize now starts from rendered dimensions, serializes canonical
  attributes, and supports exact dimensions in the image dialog.
- Kept open toolbar panels inside the viewport while responsive groups are
  redistributing, including Firefox's delayed focus and layout updates.
- Prevented keyboard navigation within color palettes from scrolling the page
  when Firefox defers its focused-swatch layout adjustment.
- Split the source editor theme into ordered foundation, toolbar, color-picker,
  contextual UI, and content partials while retaining the single published
  `@richly/core/theme.css` entry point.

## [1.0.0-rc.4] - 2026-07-13

### Fixed

- Rendered portable `Mod` shortcuts as native platform labels in toolbar
  tooltips as well as menus: `⌘` symbols on Apple platforms and `Ctrl` modifier
  names on Windows and Linux.

## [1.0.0-rc.3] - 2026-07-13

### Fixed

- Preserved ordered and unordered list structure when applying or removing
  text and background styles across list-item selections. Inline formatting is
  now clipped inside each selected `<li>`, including selections ending at
  offset `0` of the next item, preventing invalid `<span><li>…</li></span>`
  wrappers, empty items, and extra bullets.

## [1.0.0-rc.2] - 2026-07-13

### Added

- Added `toolbarMode: 'sliding'`, which keeps a single primary toolbar row and
  reveals overflow groups in an accessible, animated inline drawer.
- Added `textStyles.themeColors` to place brand colors first in both the text
  and highlight palettes while retaining the configured or built-in palette.

### Changed

- Rebuilt the demo as a responsive configuration playground with live toolbar,
  chrome, content-feature, theme-color, API-code, and sanitized-output controls,
  while retaining the Vanilla and React integration matrix.

### Fixed

- Kept the leading tool group visible in collapsed sliding toolbars and made
  overflow redistribution follow nested grid/flex constraints through framework
  host wrappers.
- Recomputed sliding overflow when toolbar styles or font metrics settle without
  changing the editor width, preventing a stale Undo/Redo-only primary row.
- Coalesced sliding-toolbar resize observations into animation frames, preventing
  reparenting feedback and unstable tool counts during continuous resizing.
- Preserved fractional grid and flex widths and excluded the More button's
  auto-alignment margin from overflow sizing, preventing valid tool groups from
  collapsing into the drawer at sub-pixel demo widths.
- Prioritized Bold and Italic ahead of clipboard actions in the default toolbar
  so narrow sliding layouts retain useful formatting controls.

## [1.0.0-rc.1] - 2026-07-13

### Added

- Added the 1.0 compatibility contract and tripwire tests for package exports,
  editor/React configuration, built-in commands and events, documented CSS
  hooks, and the sanitizer schema.
- Added `yarn a11y:audit`, powered by Playwright and axe-core, over the demo and
  representative open menu, dialog, palette, and custom-picker states.
- Added keyboard entry and roving navigation for contextual text/table
  toolbars, menubars, and table context menus.

### Changed

- Release preparation now accepts explicit prerelease versions such as
  `--version 1.0.0-rc.1`; prerelease tags publish to npm under `next` while
  stable releases use `latest`.
- The React wrapper now forwards `textStyles` and re-exports `ImagesConfig`.

## [0.9.0] - 2026-07-13

### Added

- Replaced the preset font-size toolbar select with an accessible `− [size] +`
  stepper supporting arbitrary `1–512px` values, two-decimal precision,
  keyboard increments, mixed-selection reference sizing, reset-to-inherited
  behavior, selection preservation, and one-step undo.
- Added the reusable `createFontSizeControl` API and font-size parsing,
  formatting, reference-size, control, and command argument exports.

### Changed

- Changed the `FontSize` command argument to `{ value: string | null }` ahead
  of the 1.0 API freeze. `null` removes explicit sizing; `textStyles.fontSizes`
  continues to configure the Format-menu presets.

## [0.8.0] - 2026-07-13

### Added

- Added more tags for better visibility

## [0.7.0] - 2026-07-13

### Added

- Added `blockquoteStyle` to `EditorConfig` (and the `@richly/react`
  `<Editor>` props). Default `true` preserves Richly's accent-bordered
  blockquote look; set `false` to withhold that presentation hook entirely so
  consumer CSS can style `blockquote` without a specificity fight.
- Added a Richly-native advanced picker to the text-color and background-color
  popovers, with saturation/brightness, hue, opacity, synchronized HEX and
  slider views, recent colors, presets, and selection-safe Cancel/Done actions.
- Added a `Deploy demo` GitHub Actions workflow that publishes
  `@richly/demo` to GitHub Pages on every push to `main`, plus a
  GH Pages-aware `base` path in the demo's Vite config. Linked the live demo
  from the root README and both package READMEs.
- Added structured GitHub issue templates (bug report, API feedback) and
  disabled blank issues, so soak feedback — including anything affecting the
  1.0 API freeze — is easier to triage.

## [0.6.1] - 2026-07-13

### Added

- Added detailed documentations to core and react packages

## [0.6.0] - 2026-07-12

### Added

- Added find/replace polish: a live `findreplace-count` counter in the dialog,
  Enter/Shift+Enter match navigation while the dialog is open, transient
  `rly-match` / `rly-match-current` highlighting cleaned from serialized
  content, Replace All replacement counts, and unit/e2e coverage.
- Reworked find/replace into a stateful search session with a floating,
  non-modal panel: separate **Find**, **Find Next**, **Replace**, and
  **Replace All** actions, plus a live `findreplace-count` counter ("2 of 20").
- Added keyboard navigation while the panel is open — Enter moves to the next
  match, Shift+Enter to the previous, both wrapping around.
- Added transient match highlighting via `rly-match` / `rly-match-current`
  marks, scrolled into view and stripped from `getContent()` like caret
  fillers.
- Replace All now reports how many occurrences were replaced.

### Fixed

- Fixed find/replace so replacing occurrences one at a time advances through
  stable ordinals (`2 of 20`, `3 of 20`) instead of recomputing from the start,
  and never reprocesses inserted replacement text (e.g. `dialogue` →
  `dialogue23` no longer becomes `dialogue2323`).
- Restored the demo's custom-plugin instances to the full default toolbar (with
  the Highlight button) and gave them full width so the shipped tools and
  layout-sensitive e2e coverage stay in sync.

## [0.5.0] - 2026-07-12

### Added

- Added a styled-span engine for inline CSS text styling (apply/remove/query)
  with merge-and-split semantics that avoid nested redundant spans.
- Added text style commands and value queries: `ForeColor`, `BackColor`,
  `FontSize`, `Superscript`, and `Subscript`, including
  `queryCommandValue` support in the command registry/editor facade.
- Added text-style UI controls: forecolor/backcolor swatch panels,
  `tb-select-fontsize`, and superscript/subscript toolbar + menu entries.
- Added default text-style presets and configuration hooks for color palette
  and font-size options.
- Added image upload hooks via `images.upload` (dialog file picker, paste-file,
  and drop-file routing) with `imageuploadstart`, `imageuploadend`, and
  `imageuploaderror` events.
- Added dialog `file` field support with a `files` side-channel on dialog
  results for selected `File` objects.
- Added image selection/resize frame with drag handles and frame-scoped
  keyboard resizing.

### Fixed

- Hardened text-style editing and paste flows with expanded sanitizer/clipboard
  regression coverage for color, background-color, and font-size from Word/
  Google Docs fixtures.
- Fixed text-style edge cases around mixed inline formatting, Enter splits in
  styled runs, and RemoveFormat behavior across tag+style combinations.

## [0.4.0] - 2026-07-12

## [0.3.0] - 2026-07-12

### Added

- Added repository protection: `protect-main` and `protect-release-tags`
  rulesets (applied via `scripts/apply-repo-protection.sh`), a CODEOWNERS
  file, and a Release-workflow guard that rejects tags not reachable from
  `main`.
- Added Conventional Commits enforcement via commitlint (local `commit-msg`
  hook and a `commits` CI job on pull requests).
- Added `yarn release:prepare`, which derives the next SemVer bump from the
  commit types since the last tag and updates all package versions and the
  changelog automatically.
- Added a pre-commit hook (husky + lint-staged) that auto-fixes staged files
  with ESLint and Prettier.

### Changed

- The Release workflow now runs with least-privilege permissions; only the
  publish job can write contents or mint OIDC tokens.

## [0.2.0] - 2026-07-12

### Added

- Added the explicit `toolbarMode: 'wrap' | 'more'` configuration. More mode
  collapses groups at narrow widths and restores them when space returns.

### Deprecated

- Deprecated `toolbarOverflow` in favor of `toolbarMode`; the boolean alias
  remains fully supported for backward compatibility.

### Fixed

- Fixed `toolbarMode: 'more'` and the legacy `toolbarOverflow: true` option in
  constrained consumer flex/grid layouts. Overflow is now measured against the
  editor host and includes separator margins, keeping both the toolbar and More
  control contained whenever the full toolbar cannot fit.
- Newly inserted table columns now retain their initial equal widths for normal
  content. Multi-word text wraps at spaces, while a long single word expands
  its column without being split across lines.

## [0.1.0] - 2026-07-11

### Added

- Framework-neutral TypeScript editor core and React bindings.
- Formatting, blocks, lists, alignment, links, images, source view, fullscreen,
  search/replace, preview, and visual blocks.
- Responsive toolbar with optional single-row overflow behavior.
- Clipboard actions, IME-aware undo grouping, and sanitized HTML/plain-text
  paste handling.
- Advanced tables with properties, resizing, right-click actions, multi-cell
  selection, and merge/split operations.
- Configurable word, character, and selection counts.
- Unit, accessibility-oriented UI, and Playwright browser coverage.
- Accessibility support statement and documented release/migration policies.
- Representative Word and Google Docs paste fixtures for sanitizer regression
  coverage.

### Fixed

- Firefox inline-format and link commands now recognize selections whose range
  boundaries surround the inline element from its parent node.

[Unreleased]: https://github.com/sanoopbhaskerv/richly/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/sanoopbhaskerv/richly/compare/v1.0.0...v1.0.0
[1.0.0-rc.9]: https://github.com/sanoopbhaskerv/richly/compare/v1.0.0-rc.8...v1.0.0-rc.9
[1.0.0-rc.8]: https://github.com/sanoopbhaskerv/richly/compare/v1.0.0-rc.7...v1.0.0-rc.8
[1.0.0-rc.7]: https://github.com/sanoopbhaskerv/richly/compare/v1.0.0-rc.5...v1.0.0-rc.7
[1.0.0-rc.6]: https://github.com/sanoopbhaskerv/richly/compare/v1.0.0-rc.5...v1.0.0-rc.6
[1.0.0-rc.5]: https://github.com/sanoopbhaskerv/richly/compare/v1.0.0-rc.4...v1.0.0-rc.5
[1.0.0-rc.4]: https://github.com/sanoopbhaskerv/richly/compare/v1.0.0-rc.3...v1.0.0-rc.4
[1.0.0-rc.3]: https://github.com/sanoopbhaskerv/richly/compare/v1.0.0-rc.2...v1.0.0-rc.3
[1.0.0-rc.2]: https://github.com/sanoopbhaskerv/richly/compare/v1.0.0-rc.1...v1.0.0-rc.2
[1.0.0-rc.1]: https://github.com/sanoopbhaskerv/richly/compare/v0.9.0...v1.0.0-rc.1
[0.9.0]: https://github.com/sanoopbhaskerv/richly/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/sanoopbhaskerv/richly/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/sanoopbhaskerv/richly/compare/v0.6.1...v0.7.0
[0.6.1]: https://github.com/sanoopbhaskerv/richly/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/sanoopbhaskerv/richly/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/sanoopbhaskerv/richly/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/sanoopbhaskerv/richly/compare/v0.2.0...v0.4.0
[0.3.0]: https://github.com/sanoopbhaskerv/richly/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/sanoopbhaskerv/richly/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/sanoopbhaskerv/richly/releases/tag/v0.1.0

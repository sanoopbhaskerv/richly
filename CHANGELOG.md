# Changelog

All notable changes to Richly are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and releases follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/sanoopbhaskerv/richly/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/sanoopbhaskerv/richly/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/sanoopbhaskerv/richly/compare/v0.2.0...v0.4.0
[0.3.0]: https://github.com/sanoopbhaskerv/richly/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/sanoopbhaskerv/richly/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/sanoopbhaskerv/richly/releases/tag/v0.1.0

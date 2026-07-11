# Accessibility support

Richly is designed to support WCAG 2.2 Level AA integrations, but this statement
is not a claim that every application using Richly automatically conforms.
Host-page labels, color choices, surrounding controls, authored content, and
application workflows also affect conformance.

## Supported interaction

- The editing surface exposes a labelled multiline textbox.
- Toolbar controls have accessible names, pressed states, roving tab stops, and
  left/right arrow navigation.
- Menus and dialogs expose appropriate roles and expanded/modal state.
- Dialogs trap focus, close with Escape, and restore the editor selection.
- Common formatting commands have platform-aware keyboard shortcuts.
- Tables use semantic table elements; header-cell scope is configurable.
- Light and dark themes use overridable CSS variables and visible focus states.
- UI controls do not rely on color alone to communicate active or disabled
  state.

## Test coverage

Automated checks cover keyboard operation, focus restoration, accessible state,
dialog behavior, real browser selection, and Chromium/Firefox/WebKit behavior.
Unit tests cover roles and configuration where browser interaction is not
required. See `TESTING.md` for the maintained test contract.

## Current limitations

- Formal assistive-technology certification with every browser/screen-reader
  pairing has not yet been completed.
- Multi-cell table selection is visually indicated, but a dedicated live-region
  announcement of the selected range is not yet available.
- Resizing tables and the editor is pointer-driven; equivalent numeric table
  sizing is available through Table properties, but the status-bar resize grip
  does not yet have keyboard increment controls.
- User-authored foreground/background colors can reduce contrast; applications
  should validate authored content when contrast is a publishing requirement.
- Preview content is isolated in a sandboxed frame and follows the semantics of
  the authored HTML.

## Reporting an issue

Open an accessibility issue at
<https://github.com/sanoopbhaskerv/richly/issues> with the Richly version,
browser, operating system, assistive technology, expected behavior, and a
minimal reproduction. Accessibility regressions are treated as bugs.

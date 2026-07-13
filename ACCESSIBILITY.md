# Accessibility support

Richly is designed to support WCAG 2.2 Level AA integrations, but this statement
is not a claim that every application using Richly automatically conforms.
Host-page labels, color choices, surrounding controls, authored content, and
application workflows also affect conformance.

## Supported interaction

- The editing surface exposes a labelled multiline textbox.
- Toolbar controls have accessible names, pressed states, roving tab stops, and
  left/right arrow navigation.
- The sliding toolbar drawer exposes disclosure state, excludes collapsed
  controls from navigation, and restores focus to its toggle when dismissed.
- `Alt+F10` enters a visible contextual text/table toolbar; arrows move within
  it and Escape returns focus to the editing surface.
- Menus and dialogs expose appropriate roles and expanded/modal state.
- Menubars and table context menus support arrow, Home/End, and Escape
  navigation; `Shift+F10` opens table actions from the keyboard.
- Dialogs trap focus, close with Escape, and restore the editor selection.
- Common formatting commands have platform-aware keyboard shortcuts.
- Tables use semantic table elements; header-cell scope is configurable.
- Light and dark themes use overridable CSS variables and visible focus states.
- UI controls do not rely on color alone to communicate active or disabled
  state.

## Test coverage

Automated checks cover keyboard operation, focus restoration, focus traps,
accessible state, dialog behavior, real browser selection, and
Chromium/Firefox/WebKit behavior. `yarn a11y:audit` runs axe-core over the demo
and representative open menu, modal, palette, advanced-picker, and sliding
toolbar states. Unit tests cover roles and configuration where browser
interaction is not required. See `TESTING.md` for the maintained test contract.

## Release-candidate keyboard walkthrough

Complete this walkthrough in the demo before a release candidate:

1. Tab into each editor, use the toolbar's roving Left/Right arrows, and verify
   every control has a visible focus indicator and accessible name.
2. Open the sliding toolbar with Enter, navigate from its toggle into the
   drawer with Right Arrow, and press Escape. The drawer must collapse and
   focus must return to its toggle.
3. Open every menubar menu and table context menu without a pointer. Exercise
   Arrow keys, Home, End, Enter, and Escape, checking focus restoration.
4. Open each toolbar panel, including colors and tables, and complete or cancel
   it using only the keyboard.
5. Open each modal dialog, Tab and Shift+Tab through a full focus loop, then
   cancel with Escape and verify the editor selection is restored.
6. Enter both contextual toolbars with Alt+F10, traverse their controls, and
   dismiss them with Escape.
7. Repeat the disclosure and dialog checks at a narrow viewport and with the
   operating system's reduced-motion preference enabled.

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

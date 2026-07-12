# Task list: inline text selection toolbar

## Build order

1. Add `H3` block support in `packages/core/src/plugins/blocks.ts`.
2. Add `textselectiontoolbar` plugin and register it in `packages/core/src/plugins/index.ts`.
3. Implement floating toolbar rendering, positioning, and visibility rules.
4. Add inline action icons and active-state styling.
5. Add `TESTING.md` test ids.
6. Add unit tests.
7. Add Chromium Playwright coverage.
8. Run typecheck, lint, format, unit tests, and focused e2e.

## Acceptance checklist

- [ ] Non-collapsed text selection shows inline toolbar
- [ ] Collapsed selection hides inline toolbar
- [ ] Bold action toggles and highlights active state
- [ ] Italic action toggles and highlights active state
- [ ] Link action opens/applies existing link flow
- [ ] H2 action toggles and highlights active state
- [ ] H3 action toggles and highlights active state
- [ ] Blockquote action toggles and highlights active state
- [ ] RemoveFormat clears inline formats
- [ ] Toolbar does not break table inline toolbar behavior
- [ ] Toolbar remains positioned on scroll/resize
- [ ] Focus/selection are preserved while clicking inline actions

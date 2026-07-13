# TESTING.md — Unit & Test Automation Plan

Authoritative test strategy. All UI code MUST carry `data-testid` attributes per §4 — this is a hard convention, enforced in code review.

## 1. Strategy (test pyramid)

| Layer        | Tool                                       | Runs                    | Covers                                                                  |
| ------------ | ------------------------------------------ | ----------------------- | ----------------------------------------------------------------------- |
| Unit         | **Vitest + jsdom**                         | every save / CI on push | commands, schema, undo, emitter, selection bookmarks — fast, no browser |
| E2E          | **Playwright** (chromium, firefox, webkit) | CI on PR + nightly      | real selection/typing/paste/shortcuts, toolbar UX, cross-browser quirks |
| Manual smoke | feature checklist in the pull request      | before each release     | feel, IME, edge cases not yet automated                                 |

Rule of thumb: **logic → unit test; anything touching real Selection/IME/clipboard → Playwright.**

## 2. Unit testing plan (Vitest)

- Location: `packages/core/src/**/__tests__/*.test.ts`, jsdom environment.
- The command layer is the seam. Canonical pattern:

```ts
const ed = createTestEditor('<p>hello world</p>'); // test-utils.ts
selectText(ed, 'hello'); // programmatic Range
ed.execCommand('Bold');
expect(ed.getContent()).toBe('<p><strong>hello</strong> world</p>');
```

- What must be unit-tested (per module):
  - **commands/**: every command — apply, toggle-off, overlap/nested cases, collapsed-selection behavior, `queryCommandState` truth table.
  - **model/Sanitizer**: script/event-handler stripping, whitelist enforcement, and the maintained `word-paragraphs.html`, `word-table.html`, and `google-docs.html` paste fixtures in `src/__tests__/__fixtures__/`.
  - **undo/UndoManager**: snapshot push, typing coalescing window, redo-tail truncation, max-depth cap, selection restore after undo.
  - **dom/SelectionManager**: bookmark → restore round-trip across DOM mutations.
  - **events/Emitter**: on/off/once, unsubscribe fn, emit payloads.
  - **ui registry**: toolbar spec parsing (`"undo redo | bold"` → groups).
- jsdom cannot do real user selection or clipboard — those cases get a `// e2e:` marker comment and a matching Playwright spec.
- Coverage gate: **≥80% lines on `packages/core/src`** (`vitest run --coverage`), excluding `ui/icons`.

## 3. Test automation plan (Playwright)

- Location: `e2e/` at repo root; config `playwright.config.ts` auto-starts the demo app (`yarn dev`) via `webServer`.
- Browsers: chromium + firefox + webkit projects; CI runs all three on PR.
- **All locators via `getByTestId`** — never CSS classes or text (themes/i18n must not break tests).
- Page object: `e2e/pages/EditorPage.ts` wraps common ops (`type`, `selectWord`, `clickButton('bold')`, `expectContent`), so specs stay declarative.
- Spec files map to plugins/features:
  - `basic-formatting.spec.ts` — type → select → bold/italic/underline → toolbar active-state tracks cursor
  - `blocks.spec.ts` — headings, blockquote, element path in statusbar
  - `history.spec.ts` — undo/redo via button and ⌘Z/⌘⇧Z, typing coalescing
  - `shortcuts.spec.ts` — all keyboard shortcuts, Alt+F10 toolbar focus, roving tabindex
  - `advanced-editing.spec.ts` — IME undo grouping, safe plain-text paste, table merge/split, search/replace, preview, and visual blocks
  - `lists.spec.ts`, `link.spec.ts`, `table.spec.ts`, `image.spec.ts` — as those plugins land (Milestone 2)
  - `image-upload.spec.ts` — file upload (dialog/paste), placeholder cleanup, resize frame drag + keyboard
  - `react.spec.ts` — React demo pane behaves identically to vanilla pane (both are on the demo page)
- Artifacts: screenshots + traces on failure (`trace: 'on-first-retry'`).
- CI: GitHub Actions runs coverage/build quality gates and a Playwright matrix over Chromium, Firefox, and WebKit. Version tags additionally run the gated release workflow.

## 4. data-testid registry (canonical — keep in sync when adding UI)

Pattern: kebab-case, stable, semantic. Never derive from labels/i18n. One editor per testid scope; for multi-instance pages scope queries by root.

| Element                                 | data-testid                                                                       |
| --------------------------------------- | --------------------------------------------------------------------------------- |
| Editor root wrapper                     | `editor-root`                                                                     |
| Menubar / toolbar / content / statusbar | `editor-menubar`, `editor-toolbar`, `editor-content`, `editor-statusbar`          |
| Toolbar button                          | `tb-<name>` (e.g. `tb-bold`, `tb-undo`, `tb-h1`)                                  |
| Toolbar overflow                        | `tb-more`, `toolbar-more-panel`                                                   |
| Preview                                 | `preview-overlay`, `preview-frame`, `preview-close`                               |
| Toolbar select (blocks/fonts)           | `tb-select-<name>`                                                                |
| Menubar menu button                     | `menu-<name>` (e.g. `menu-file`)                                                  |
| Menu item                               | `menuitem-<id>`                                                                   |
| Dropdown panel                          | `dd-<name>` (e.g. `dd-table`, `dd-forecolor`)                                     |
| Table grid cell                         | `grid-cell-<row>-<col>`                                                           |
| Color swatch                            | `swatch-<hex-no-hash>`                                                            |
| WP3 text style dropdowns                | `dd-forecolor`, `dd-backcolor`                                                    |
| WP3 font size select                    | `tb-select-fontsize`                                                              |
| WP3 clear swatch                        | `swatch-none`                                                                     |
| Custom text/background color action     | `custom-color`                                                                    |
| Advanced color controls                 | `color-picker-sv`, `color-picker-hue`, `color-picker-opacity`, `color-picker-hex` |
| Advanced color actions                  | `color-picker-back`, `color-picker-cancel`, `color-picker-done`                   |
| Dialog / field / actions                | `dialog-<name>`, `dialog-field-<name>`, `dialog-submit`, `dialog-cancel`          |
| Statusbar parts                         | `status-elpath`, `status-wordcount`, `status-resize`                              |
| Context toolbar                         | `ctx-toolbar`, buttons reuse `tb-<name>`                                          |
| Inline text toolbar                     | `text-inline-toolbar`, `inline-text-action-<id>`                                  |
| Image selection frame                   | `image-selection`                                                                 |
| Image resize handles                    | `image-resize-x`, `image-resize-y`, `image-resize-xy`                             |

Implementation rule: testids are attached in core UI components (`ui/`), driven by the registered button/dialog name — plugin authors get them for free.

## 5. Commands

```bash
yarn test              # unit (vitest)
yarn test:coverage     # coverage report
yarn e2e               # playwright, all browsers
yarn e2e --project=chromium --headed   # debug one browser
yarn a11y:audit        # axe-core against the demo and open interactive states
```

## 6. Definition of done (any feature PR)

1. Unit tests for every new command/module, including toggle-off and edge cases.
2. Playwright spec (or extension of one) if the feature has UI or real-selection behavior.
3. New UI elements registered in §4 table with data-testids.
4. `yarn test` and `yarn e2e --project=chromium` green locally.

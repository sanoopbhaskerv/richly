# Richly roadmap

## Current state (0.4.0 — published to npm)

**Editing.** Framework-neutral TypeScript core with React bindings. Inline
formats (bold, italic, underline, strikethrough, clear formatting) with
collapsed-cursor pending formats, blocks (headings, paragraph, quote),
alignment, indent/outdent, lists with Tab nesting, links with autolink,
images, horizontal rules, IME-aware undo grouping, and sanitized HTML/plain
paste with Word and Google Docs fixtures.

**Tables.** Grid-picker insert, row/column operations, table/cell/row
properties dialogs, semantic header rows, multi-cell selection with
merge/split, column drag-resize, whole-table resize frame, a floating inline
options toolbar, and right-click actions.

**Document tools.** Find/replace, preview, visual blocks, source-code view,
fullscreen, clipboard commands, configurable word/character/selection counts,
editor resize grip, responsive toolbar (`toolbarMode: 'wrap' | 'more'`), and a
registry-driven menubar.

**Engineering.** 100+ unit tests plus Playwright coverage on chromium,
firefox, and webkit; commitlint-enforced Conventional Commits; automatic
version derivation (`yarn release:prepare`); branch/tag protection rulesets;
environment-gated npm publishing with provenance.

## Gate for a stable 1.0.0

1.0 freezes the public compatibility surface (RELEASING.md): exported APIs,
commands, configuration, events, CSS contract, and sanitized HTML. Before
committing to that:

1. **Close the common-formatting gap** — text/background color, sub/super
   script, and font size are table stakes for a WYSIWYG editor and would be
   breaking-ish to bolt on after an API freeze.
2. **Image upload hook and resize handles** — the URL-only image flow is not
   1.0-complete, and an upload callback shapes the public config API.
3. **Plugin authoring guide with worked examples** — the plugin API is the
   product; it cannot freeze undocumented.
4. **Real-world soak** — publish 0.x to npm and gather at least one release
   cycle of external usage before freezing the API. Expect a 0.4/0.5 series.
5. **Find/replace polish** — match counts and keyboard navigation.
6. **Release-candidate pass** — full three-browser e2e, accessibility audit
   against ACCESSIBILITY.md, and a MIGRATING.md entry finalizing the 0.x→1.0
   contract.

## Post-1.0 candidates

- Markdown input shortcuts and slash commands.
- Mentions/annotations plugin.
- Collaboration-ready document model exploration.
- Autosave and local draft recovery.

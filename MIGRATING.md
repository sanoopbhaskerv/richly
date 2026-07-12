# Migration policy

This document describes how Richly communicates and supports compatibility
changes.

## Support policy

- Patch releases do not intentionally break documented APIs or serialized
  content.
- Minor releases add compatible functionality. Before 1.0, a minor release may
  contain a necessary breaking change when the changelog and this guide provide
  an explicit migration path.
- Major releases may remove deprecated APIs or change compatibility surfaces.
- Deprecations remain available for at least one minor release whenever a safe
  compatibility bridge is practical.

Each breaking migration documents the affected versions, who is affected,
before/after examples, serialized-content implications, and a rollback path.

## Compatibility surfaces

Treat changes to these areas as public migrations:

- package names, exports, and peer dependency ranges;
- exported TypeScript types and React props;
- editor configuration, commands, events, and plugin contracts;
- documented CSS variables, theme entry points, and stable test IDs;
- sanitizer behavior and generated HTML semantics.

Internal DOM structure and undocumented CSS classes may change without notice.

## Unreleased: toolbar layout naming

`toolbarOverflow` is deprecated because the boolean did not communicate whether
tools would wrap, clip, or move into a menu. Use the explicit `toolbarMode`
option instead:

```ts
// Before — still supported
toolbarOverflow: true;

// After
toolbarMode: 'more';
```

`toolbarOverflow: false` maps to `toolbarMode: 'wrap'`. When both options are
provided, `toolbarMode` takes precedence. The compatibility alias will remain
through the 0.x release line and will not be removed without a major-version
migration notice.

## 0.1.0

This is the first public Richly release, so no migration is required. Earlier
development builds used the names `SB Editor`, `@sb/editor-core`, and
`@sb/editor-react`; those unpublished names are replaced by `Richly`,
`@richly/core`, and `@richly/react`.

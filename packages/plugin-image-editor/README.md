# @richly/plugin-image-editor

Richly editor plugin that will expose the optional `imageedit` action bridging
the editor to Image Studio (or any host-provided image editor).

> **Status: scaffolding only.** This package is `private: true` at version
> `0.0.0` and is not published. It becomes public (`0.1.0`) only after the
> Changesets release migration described in
> [`docs/image-studio/architecture.md`](../../docs/image-studio/architecture.md).

## What will live here (PR 7)

- The `imageedit` plugin action for `@richly/core`
- Selection bookmarking and async editor launch (`skipUndo: true`)
- Persistence bridge: persist first, then one undoable DOM update
- No automatic uploads and no edit manifests embedded in HTML

## Boundaries

- `@richly/core` is a **peer dependency** — the plugin attaches to the host's
  editor instance.
- Must not depend on `@richly/react` or React: vanilla and React hosts share
  this bridge.
- Must not import the Image Studio UI; hosts inject `openEditor` so the
  studio stays lazy-loadable.

These rules are enforced by `src/__tests__/dependency-boundaries.test.ts`.

## Scripts

| Script               | Purpose                        |
| -------------------- | ------------------------------ |
| `yarn build`         | tsup ESM + CJS + `.d.ts` build |
| `yarn test`          | Vitest (Node environment)      |
| `yarn test:coverage` | Vitest with V8 coverage        |

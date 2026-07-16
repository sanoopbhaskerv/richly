# @richly/image-react

React bindings and interaction primitives for the Richly image editing engine.

> **Status: scaffolding only.** This package is `private: true` at version
> `0.0.0` and is not published. It becomes public (`0.1.0`) only after the
> Changesets release migration described in
> [`docs/image-studio/architecture.md`](../../docs/image-studio/architecture.md).

## What will live here

- `ImageEditorProvider` and `useImageEditorState(selector)`
- The UI interaction store (active tool, viewport, crop draft)
- `ImageCanvas`, `CropOverlay`, and gesture handling
- `useImageCommands`, `useImageHistory`, `useCropTool`, `useViewport`,
  `useImageExport`

## Boundaries

- Depends only on `@richly/image-core`.
- `react` and `react-dom` are **peer dependencies** — never bundled.
- Must not depend on `@richly/core` or `@richly/react`.

These rules are enforced by `src/__tests__/dependency-boundaries.test.ts`.

## Scripts

| Script               | Purpose                        |
| -------------------- | ------------------------------ |
| `yarn build`         | tsup ESM + CJS + `.d.ts` build |
| `yarn test`          | Vitest (jsdom environment)     |
| `yarn test:coverage` | Vitest with V8 coverage        |

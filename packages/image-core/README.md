# @richly/image-core

Framework-agnostic, non-destructive image editing engine for Richly Image
Studio.

> **Status: scaffolding only.** This package is `private: true` at version
> `0.0.0` and is not published. It becomes public (`0.1.0`) only after the
> Changesets release migration described in
> [`docs/image-studio/architecture.md`](../../docs/image-studio/architecture.md).

## What will live here

- `createImageSession` / `restoreImageSession`
- Operation validation, normalization, and the operation registry
- Undo/redo history with structural sharing
- Preview rendering and final export pipelines
- The serializable `ImageEditDocument`

## Boundaries

- **No React.** The engine must run in workers, Node tooling, and non-React
  hosts.
- **No `@richly/core` or `@richly/react`.** Editor integration lives in
  `@richly/plugin-image-editor`.

These rules are enforced by `src/__tests__/dependency-boundaries.test.ts`.

## Scripts

| Script               | Purpose                        |
| -------------------- | ------------------------------ |
| `yarn build`         | tsup ESM + CJS + `.d.ts` build |
| `yarn test`          | Vitest (Node environment)      |
| `yarn test:coverage` | Vitest with V8 coverage        |

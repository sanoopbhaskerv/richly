# @richly/image-studio

The complete Image Studio editing experience: responsive shell, tools,
panels, hosting, and the programmatic controller.

> **Status: scaffolding only.** This package is `private: true` at version
> `0.0.0` and is not published. It becomes public (`0.1.0`) only after the
> Changesets release migration described in
> [`docs/image-studio/architecture.md`](../../docs/image-studio/architecture.md).

## Entry points

| Specifier                         | Contents                                        |
| --------------------------------- | ----------------------------------------------- |
| `@richly/image-studio`            | React UI composition (`ImageStudio`, hosts)     |
| `@richly/image-studio/controller` | Framework-independent controller — **no React** |

A `./styles.css` export will be added when the UI ships (PR 6).

## Boundaries

- Depends on `@richly/image-core` and `@richly/image-react`.
- `react` and `react-dom` are **peer dependencies** — never bundled.
- Must not depend on `@richly/core` or `@richly/react`.
- The `./controller` subpath must never import React.

These rules are enforced by `src/__tests__/dependency-boundaries.test.ts`.

## Scripts

| Script               | Purpose                                       |
| -------------------- | --------------------------------------------- |
| `yarn build`         | tsup ESM + CJS + `.d.ts` build (both entries) |
| `yarn test`          | Vitest (jsdom environment)                    |
| `yarn test:coverage` | Vitest with V8 coverage                       |

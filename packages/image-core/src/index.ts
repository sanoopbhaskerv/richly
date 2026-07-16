/**
 * @richly/image-core — framework-agnostic image editing engine.
 *
 * This package will own the non-destructive editing session model: source
 * decoding, operation validation and normalization, undo/redo history,
 * preview rendering, and export. The approved public API lives in
 * `docs/image-studio/architecture.md` (PR 2+).
 *
 * PR 1 intentionally ships no editing behavior. The entry point exists so
 * that workspace linking, dependency-ordered builds, and package boundaries
 * can be established and verified before any functionality lands.
 *
 * Boundary rules (enforced by `src/__tests__/dependency-boundaries.test.ts`):
 * - Must not depend on React or React DOM.
 * - Must not depend on `@richly/core` or `@richly/react`.
 *
 * @packageDocumentation
 */

/**
 * Canonical npm name of this package.
 *
 * Downstream scaffolding (`@richly/image-react`, `@richly/image-studio`)
 * re-exposes this value to prove that workspace resolution and
 * dependency-ordered builds work before real APIs exist. It also gives the
 * Vitest scaffolding a concrete export to assert on.
 */
export const IMAGE_CORE_PACKAGE_NAME = '@richly/image-core';

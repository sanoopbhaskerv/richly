/**
 * @richly/image-react — React bindings for the Richly image editing engine.
 *
 * This package will own React interaction state (active tool, viewport,
 * crop drafts, gestures) layered over `@richly/image-core` sessions via
 * `useSyncExternalStore`. The approved hook and provider surface lives in
 * `docs/image-studio/architecture.md` §§11–13 (PR 5).
 *
 * PR 1 intentionally ships no components or hooks. The entry point exists to
 * establish the package boundary and the dependency edge to the engine.
 *
 * Boundary rules (enforced by `src/__tests__/dependency-boundaries.test.ts`):
 * - React and React DOM are peer dependencies, never bundled dependencies.
 * - May depend on `@richly/image-core` only; never on `@richly/core` or
 *   `@richly/react`.
 *
 * @packageDocumentation
 */
import { IMAGE_CORE_PACKAGE_NAME } from '@richly/image-core';

/**
 * Canonical npm name of this package.
 *
 * Exists so scaffolding tests and downstream packages have a stable export to
 * assert on before real APIs land.
 */
export const IMAGE_REACT_PACKAGE_NAME = '@richly/image-react';

/**
 * Workspace packages this package layers on top of.
 *
 * The value is imported (not inlined) from `@richly/image-core` on purpose:
 * it forces the workspace dependency edge to resolve at build and test time,
 * proving the dependency-ordered build works before any behavior exists.
 */
export const IMAGE_REACT_UPSTREAM_PACKAGES = [IMAGE_CORE_PACKAGE_NAME] as const;

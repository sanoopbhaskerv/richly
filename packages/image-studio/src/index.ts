/**
 * @richly/image-studio — the complete Image Studio editing experience.
 *
 * This package will own the visual composition: responsive shell, tool rail,
 * context panels, modal/inline hosting, save/cancel workflow, and theming,
 * per `docs/image-studio/architecture.md` §§3, 14 and the UI handoff module
 * plan (PR 6).
 *
 * PR 1 intentionally ships no UI. The entry point exists to establish the
 * package boundary and the dependency edges to the engine and the React
 * primitives.
 *
 * The framework-independent programmatic controller is deliberately NOT
 * exported from here — it lives at the dedicated `@richly/image-studio/controller`
 * subpath (see `./controller.ts`) so hosts can use it without bundling React.
 *
 * @packageDocumentation
 */
import { IMAGE_CORE_PACKAGE_NAME } from '@richly/image-core';
import { IMAGE_REACT_PACKAGE_NAME } from '@richly/image-react';

/**
 * Canonical npm name of this package.
 *
 * Exists so scaffolding tests and the demo application have a stable export
 * to assert on before real APIs land.
 */
export const IMAGE_STUDIO_PACKAGE_NAME = '@richly/image-studio';

/**
 * Workspace packages this package layers on top of.
 *
 * The values are imported (not inlined) on purpose: they force both workspace
 * dependency edges to resolve at build and test time, proving the
 * dependency-ordered build works before any behavior exists.
 */
export const IMAGE_STUDIO_UPSTREAM_PACKAGES = [
  IMAGE_CORE_PACKAGE_NAME,
  IMAGE_REACT_PACKAGE_NAME
] as const;

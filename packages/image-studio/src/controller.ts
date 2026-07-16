/**
 * @richly/image-studio/controller — framework-independent controller entry.
 *
 * The programmatic `ImageStudioController` (open/close/subscribe, PR 6) is
 * published from this dedicated subpath rather than the main entry, per
 * `docs/image-studio/architecture.md` §14: hosts such as the Richly
 * `imageedit` plugin must be able to create and drive the controller without
 * React entering their bundle, and relying on tree-shaking alone was
 * explicitly rejected.
 *
 * INVARIANT: nothing in this module graph may import `react`, `react-dom`,
 * or any module that does. `src/__tests__/dependency-boundaries.test.ts`
 * enforces this for the scaffolding; keep it true as the controller grows.
 *
 * @packageDocumentation
 */

/**
 * Import specifier of the React-free controller entry point.
 *
 * Exists so scaffolding tests can assert the subpath contract before the
 * controller implementation lands.
 */
export const IMAGE_STUDIO_CONTROLLER_ENTRY = '@richly/image-studio/controller';

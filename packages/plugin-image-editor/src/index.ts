/**
 * @richly/plugin-image-editor — Richly editor bridge to Image Studio.
 *
 * This package will provide the optional `imageedit` plugin action described
 * in `docs/image-studio/architecture.md` §16 (PR 7): capturing the selected
 * image, launching a host-provided editor (typically the Image Studio
 * controller), persisting the result, and applying exactly one undoable DOM
 * update on success.
 *
 * PR 1 intentionally ships no plugin behavior. The entry point exists to
 * establish the package boundary.
 *
 * Boundary rules (enforced by `src/__tests__/dependency-boundaries.test.ts`):
 * - `@richly/core` is a peer dependency only — the plugin attaches to the
 *   host's editor instance and must never bundle a second engine copy.
 * - Must not depend on `@richly/react`: the plugin targets the
 *   framework-agnostic core so vanilla and React hosts share one bridge.
 * - Must not import the Image Studio UI; hosts inject `openEditor`, keeping
 *   the studio lazy-loadable and outside default editor bundles.
 *
 * @packageDocumentation
 */

/**
 * Canonical npm name of this package.
 *
 * Exists so scaffolding tests have a stable export to assert on before the
 * real plugin API lands.
 */
export const PLUGIN_IMAGE_EDITOR_PACKAGE_NAME = '@richly/plugin-image-editor';

/**
 * Identifier of the editor action this plugin will register (PR 7).
 *
 * Declared now so toolbar planning and host integrations can reference a
 * stable command name ahead of the implementation.
 */
export const IMAGE_EDIT_ACTION_NAME = 'imageedit';

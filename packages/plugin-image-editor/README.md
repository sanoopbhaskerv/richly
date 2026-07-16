# @richly/plugin-image-editor

Richly editor plugin exposing the optional `imageedit` action that bridges the
editor to Image Studio (or any host-provided image editor).

> **Status: private implementation preview.** This package is `private: true`
> at version `0.0.0` and is not published. It becomes public (`0.1.0`) only
> after the Changesets release migration described in
> [`docs/image-studio/architecture.md`](../../docs/image-studio/architecture.md).

## API

```ts
import { imageEditorPlugin } from '@richly/plugin-image-editor';

const plugin = imageEditorPlugin({
  openEditor: controller.open,
  persist: async (result) => {
    const asset = await mediaRepository.persist(result.blob, result.editDocument);
    return {
      src: asset.url,
      alt: result.alt,
      width: result.width,
      height: result.height,
      editDocumentRef: asset.editRef
    };
  }
});
```

The command captures the selected image and selection bookmark, launches the
host editor with `skipUndo: true`, persists the result first, then applies one
undoable DOM update. Cancelled edits do not mutate Richly HTML. Edit manifests
remain host-owned and are never embedded directly in HTML.

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

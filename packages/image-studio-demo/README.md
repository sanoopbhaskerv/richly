# @richly/image-studio-demo

Standalone demo application and installable PWA host for Richly Image Studio.

> **Permanently private.** This workspace is never published to npm and is
> excluded from library-oriented root scripts (see `--ignore` flags in the
> root `package.json`).

## Why this package exists

Per [`docs/image-studio/architecture.md`](../../docs/image-studio/architecture.md)
§18, PWA behavior (manifest, service worker, install prompt, offline shell,
local persistence) belongs to a standalone application, never to the library
packages. This workspace is that application.

## Current State

The app creates a generated local image, opens it in the complete Studio UI,
and turns exports into local Blob URL downloads. Its manifest, icon, and service
worker cleanup are intentionally kept in this private app package.

Offline caching is currently disabled so local development and browser automation
always load fresh assets. The `/sw.js` file only removes older demo caches and
unregisters itself for browsers that previously installed the offline shell.

## LiteRT Smart Enhance

The AI Tools panel is wired to the real optional `@richly/image-ai-litert`
provider. It does not bundle a model. To enable **Apply smart enhance**, copy
`.env.example` to `.env`, set `VITE_IMAGE_STUDIO_SMART_ENHANCE_MODEL_URL` to a
real `.tflite` model, and tune the tensor/output mapping for that model.

LiteRT Wasm files are served by the Vite config from
`node_modules/@litertjs/core/wasm/` at `/litert/wasm/` in dev and copied into
the production build.

## Scripts

| Script       | Purpose                                    |
| ------------ | ------------------------------------------ |
| `yarn dev`   | Vite dev server on port 5178 (strict port) |
| `yarn build` | Production build (not run by root `build`) |

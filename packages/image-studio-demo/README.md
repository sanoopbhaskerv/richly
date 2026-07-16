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

## Scripts

| Script       | Purpose                                    |
| ------------ | ------------------------------------------ |
| `yarn dev`   | Vite dev server on port 5178 (strict port) |
| `yarn build` | Production build (not run by root `build`) |

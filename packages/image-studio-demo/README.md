# @richly/image-studio-demo

Standalone demo application — and future installable PWA host — for Richly
Image Studio.

> **Permanently private.** This workspace is never published to npm and is
> excluded from library-oriented root scripts (see `--ignore` flags in the
> root `package.json`).

## Why this package exists

Per [`docs/image-studio/architecture.md`](../../docs/image-studio/architecture.md)
§18, PWA behavior (manifest, service worker, install prompt, offline shell,
local persistence) belongs to a standalone application, never to the library
packages. This workspace is that application.

## Current state

A placeholder page that smoke-tests workspace resolution of
`@richly/image-studio` and its upstream packages. The real editor UI arrives
with PR 6.

## Scripts

| Script       | Purpose                                    |
| ------------ | ------------------------------------------ |
| `yarn dev`   | Vite dev server on port 5178 (strict port) |
| `yarn build` | Production build (not run by root `build`) |

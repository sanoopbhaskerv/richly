# Contributing to Richly

Thanks for helping improve Richly.

## Local setup

Use Node.js 18.18 or newer and Yarn 1.22:

```bash
yarn install
yarn dev
```

## Before opening a pull request

```bash
yarn format:write
yarn lint
yarn format
yarn test:coverage
yarn build
yarn e2e --project=chromium
```

Add unit coverage for command and model changes. Add Playwright coverage when a
change affects browser selection, keyboard behavior, dialogs, or editor UI.
Add a concise entry under `CHANGELOG.md`'s `Unreleased` section for every
user-visible change. Follow `MIGRATING.md` when a compatibility surface changes.

## Commit guidance

Keep commits focused and describe the user-visible effect. Do not commit build
output, coverage data, local environment files, or Playwright artifacts.

Maintainers preparing a release should follow `RELEASING.md` and run
`yarn release:check` before creating a version tag.

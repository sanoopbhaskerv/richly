# Contributing to SB Editor

Thanks for helping improve SB Editor.

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

## Commit guidance

Keep commits focused and describe the user-visible effect. Do not commit build
output, coverage data, local environment files, or Playwright artifacts.

# Contributing to Richly

Thanks for helping improve Richly.

## Local setup

Use Node.js 18.18 or newer and Yarn 1.22:

```bash
yarn install
yarn dev
```

`yarn install` also activates the pre-commit hook (husky + lint-staged): staged
files are auto-fixed with ESLint and Prettier on every commit. The hook is a
convenience — CI remains the enforcement gate — so avoid `--no-verify`.

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

Commit messages must follow [Conventional Commits](https://www.conventionalcommits.org/)
(`feat:`, `fix:`, `docs:`, `chore:`, …, with `!` or a `BREAKING CHANGE:` footer
for incompatible changes). This is enforced by the local `commit-msg` hook and
by the `commits` CI job on every pull request. The types matter: they drive
automatic version derivation via `yarn release:prepare`.

Keep commits focused and describe the user-visible effect. Do not commit build
output, coverage data, local environment files, or Playwright artifacts.

Maintainers preparing a release should follow `RELEASING.md` and run
`yarn release:check` before creating a version tag.

# Contributing to Richly

Thanks for helping improve Richly.

## Local setup

For development, use Node.js 22.18+ (22.x), 24.11+ (24.x), or 26+, with Yarn 1.22.
CI covers Node 22 and 24. These build-tool requirements do not change the public
packages' runtime engine requirements.

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
yarn security:tooling
yarn lint
yarn format
yarn test:coverage
yarn build
yarn e2e --project=chromium
```

The core build minifies its distributable JavaScript and enforces gzip budgets
for ESM, CommonJS, and the published theme. `yarn size:check` rechecks the
current build output without rebuilding; budget changes require an intentional
review alongside the feature that needs the additional transfer size.

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

## Security-related toolchain resolution

The root `resolutions` entry for
`**/@typescript-eslint/typescript-estree/minimatch` is intentionally scoped to the
parser. It replaces vulnerable minimatch 10 with 11.0.8 while the parser still
declares the older range. The parser uses only the retained `minimatch()` function
with `dot: true`, not the removed `makeRe`/AST APIs. `yarn security:tooling` checks
the resolved version and representative parser matching behavior. Remove this
resolution once the upstream parser declares a patched compatible range, after
rerunning lint and this check. Do not broaden it to other consumers blindly.

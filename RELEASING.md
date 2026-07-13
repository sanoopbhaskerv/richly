# Releasing Richly

Richly follows [Semantic Versioning](https://semver.org/) for both public
packages. `@richly/core` and `@richly/react` are released together with the
same version so their compatibility is obvious.

## Version policy

- **Patch** (`0.1.1`): compatible bug fixes, documentation corrections, and
  internal improvements.
- **Minor** (`0.2.0`): backward-compatible features and new optional APIs.
- **Major** (`1.0.0`): incompatible public API, command, serialized HTML, CSS
  contract, or package-entry changes.

Before 1.0, incompatible changes may ship in a minor release, but they must be
called out under `Changed` and `Breaking` in `CHANGELOG.md` and documented in
`MIGRATING.md`. Patch releases remain backward compatible.

The public compatibility surface includes exported TypeScript APIs, package
exports, editor configuration, command names and arguments, event payloads,
documented CSS variables/classes, and the sanitized HTML contract.

## Prepare a release

1. Create a release branch from a green `main` branch.
2. Run `yarn release:prepare` — it derives the bump from Conventional Commits
   since the last tag (feat → minor, fix → patch, breaking → major, mapped to
   minor while pre-1.0), updates all package versions, `@richly/react`'s
   `@richly/core` range, and rolls `CHANGELOG.md`'s `Unreleased` section into
   a dated version section. Use `--dry-run` to preview; review the diff and
   the changelog wording before committing. For an explicit release candidate,
   use `yarn release:prepare --version 1.0.0-rc.1`. Running the command without
   `--version` on a prerelease promotes its base version (`1.0.0-rc.1` →
   `1.0.0`).
3. Add migration instructions when the release changes a compatibility
   surface.
4. Run:

   ```bash
   yarn release:check
   yarn a11y:audit
   yarn e2e
   ```

5. For a 1.0 release candidate, complete the keyboard-only walkthrough in
   `ACCESSIBILITY.md` and a smoke test in real Safari. Playwright WebKit is
   required CI coverage but does not replace the Safari smoke.

6. Merge the release branch, then create and push an annotated tag:

   ```bash
   git tag -a v0.1.0 -m "Richly v0.1.0"
   git push origin v0.1.0
   ```

The `Release` GitHub Actions workflow verifies the tag matches both package
versions, runs the release checks, publishes core before React with npm
provenance, and creates a GitHub release from the changelog. Prerelease tags
publish under npm's `next` dist-tag; stable tags publish under `latest`.

## Repository protection

Releases must not be triggerable by a direct push. Protection has three
layers, applied once per repository:

1. **Branch ruleset `protect-main`** — main only changes through pull requests
   with a code-owner review (`.github/CODEOWNERS`) and green CI (quality +
   browser jobs); force pushes and deletion are blocked.
2. **Tag ruleset `protect-release-tags`** — only repository admins can create,
   move, or delete `v*` tags, so only admins can trigger the Release workflow.
   The workflow additionally refuses tags whose commit is not on `main`.
3. **`npm` environment approval** — publishing waits for a required reviewer
   even after a valid tag; the `NPM_TOKEN` secret lives only in this
   environment.

Apply rulesets 1–2 with `./scripts/apply-repo-protection.sh` (needs an
admin-authenticated `gh` CLI); the script prints the two settings that must be
confirmed in the UI. Repository admins currently bypass the branch ruleset so
a solo maintainer can merge — remove that bypass when a second maintainer
joins.

## npm setup

The repository environment named `npm` should require maintainer approval. Add
an `NPM_TOKEN` secret with publish access to `@richly/core` and
`@richly/react`. Prefer npm trusted publishing when it is available for the
repository; the workflow already grants the OIDC `id-token: write` permission
needed for provenance.

Never publish from an uncommitted working tree or manually publish only one of
the two packages.

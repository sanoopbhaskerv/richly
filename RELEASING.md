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
2. Update both package versions to the same SemVer value.
3. Update `@richly/react`'s `@richly/core` dependency to the matching caret
   range.
4. Move relevant entries from `CHANGELOG.md`'s `Unreleased` section into a
   dated version section.
5. Add migration instructions when the release changes a compatibility
   surface.
6. Run:

   ```bash
   yarn release:check
   ```

7. Merge the release branch, then create and push an annotated tag:

   ```bash
   git tag -a v0.1.0 -m "Richly v0.1.0"
   git push origin v0.1.0
   ```

The `Release` GitHub Actions workflow verifies the tag matches both package
versions, runs the release checks, publishes core before React with npm
provenance, and creates a GitHub release from the changelog.

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

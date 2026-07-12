/**
 * Commit message standard: Conventional Commits.
 * Enforced locally by the husky commit-msg hook and authoritatively by the
 * commitlint job in CI (hooks can be bypassed with --no-verify; CI cannot).
 *
 * The commit types drive automatic version derivation in
 * scripts/prepare-release.mjs: feat → minor, fix/perf/refactor → patch,
 * "type!:" or a BREAKING CHANGE footer → major (minor while pre-1.0).
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Existing history uses descriptive subjects; allow longer headers.
    'header-max-length': [2, 'always', 120],
    // Bodies are prose/bullet lists — only the header drives tooling
    // (version derivation, changelog), so don't cap body line length.
    'body-max-line-length': [0]
  }
};

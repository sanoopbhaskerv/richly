/**
 * Derives the next SemVer version from Conventional Commits since the last
 * v* tag and applies it across the repository:
 *
 *   - root, @richly/core, @richly/react, @richly/demo package versions
 *   - @richly/react's dependency range on @richly/core (^x.y.z)
 *   - CHANGELOG.md: converts [Unreleased] into a dated [x.y.z] section and
 *     refreshes the compare links
 *
 * Bump rules (commit types are enforced by commitlint):
 *   - "type!" or a BREAKING CHANGE footer  → major (minor while pre-1.0,
 *     matching RELEASING.md's pre-1.0 policy)
 *   - feat                                 → minor
 *   - anything else (fix, perf, refactor…) → patch
 *
 * Usage:
 *   node scripts/prepare-release.mjs            # apply
 *   node scripts/prepare-release.mjs --dry-run  # print the plan only
 *   node scripts/prepare-release.mjs --version 1.0.0-rc.1
 *
 * When the current version is a prerelease, the default action promotes its
 * base version (1.0.0-rc.1 → 1.0.0), even when no commits followed the RC tag.
 *
 * This intentionally does NOT create the git tag: tags are restricted to
 * repository admins (see RELEASING.md "Repository protection") and go through
 * the release-branch flow.
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const dryRun = process.argv.includes('--dry-run');
const versionIndex = process.argv.indexOf('--version');
const inlineVersion = process.argv.find((arg) => arg.startsWith('--version='))?.slice(10);
const requestedVersion = inlineVersion ?? (versionIndex >= 0 ? process.argv[versionIndex + 1] : '');
const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

if (versionIndex >= 0 && !requestedVersion) {
  console.error('--version requires a SemVer value, for example 1.0.0-rc.1.');
  process.exit(1);
}
if (requestedVersion && !SEMVER.test(requestedVersion)) {
  console.error(`Invalid --version value: ${requestedVersion}`);
  process.exit(1);
}

const sh = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim();
const rootPkg = JSON.parse(readFileSync('package.json', 'utf8'));
const current = rootPkg.version;
const currentMatch = SEMVER.exec(current);
if (!currentMatch) {
  console.error(`Current package version is not valid SemVer: ${current}`);
  process.exit(1);
}
const currentPrerelease = current.includes('-');

const compareSemver = (left, right) => {
  const parse = (version) => {
    const withoutBuild = version.split('+')[0];
    const [base = '', prerelease] = withoutBuild.split('-', 2);
    return {
      base: base.split('.').map(Number),
      prerelease: prerelease?.split('.') ?? null
    };
  };
  const a = parse(left);
  const b = parse(right);
  for (let index = 0; index < 3; index++) {
    if (a.base[index] !== b.base[index]) return (a.base[index] ?? 0) - (b.base[index] ?? 0);
  }
  if (!a.prerelease && !b.prerelease) return 0;
  if (!a.prerelease) return 1;
  if (!b.prerelease) return -1;
  const length = Math.max(a.prerelease.length, b.prerelease.length);
  for (let index = 0; index < length; index++) {
    const aPart = a.prerelease[index];
    const bPart = b.prerelease[index];
    if (aPart === undefined) return -1;
    if (bPart === undefined) return 1;
    if (aPart === bPart) continue;
    const aNumber = /^\d+$/.test(aPart) ? Number(aPart) : null;
    const bNumber = /^\d+$/.test(bPart) ? Number(bPart) : null;
    if (aNumber !== null && bNumber !== null) return aNumber - bNumber;
    if (aNumber !== null) return -1;
    if (bNumber !== null) return 1;
    return aPart.localeCompare(bPart);
  }
  return 0;
};

if (requestedVersion && compareSemver(requestedVersion, current) <= 0) {
  console.error(`Requested version ${requestedVersion} must be newer than ${current}.`);
  process.exit(1);
}

// --- collect commits since the last release tag ------------------------------
let lastTag = '';
try {
  lastTag = sh("git describe --tags --abbrev=0 --match 'v*'");
} catch {
  console.error('No v* tag found; cannot derive a bump. Tag an initial release first.');
  process.exit(1);
}
const range = `${lastTag}..HEAD`;
const commits = sh(`git log ${range} --format=%s%x00%b%x01`)
  .split('\x01')
  .map((entry) => entry.trim())
  .filter(Boolean)
  .map((entry) => {
    const [subject = '', body = ''] = entry.split('\x00');
    return { subject, body };
  });

if (commits.length === 0 && !requestedVersion && !currentPrerelease) {
  console.error(`No commits since ${lastTag}; nothing to release.`);
  process.exit(1);
}

// --- derive the bump ---------------------------------------------------------
const HEADER = /^(?<type>[a-z]+)(?:\([^)]*\))?(?<bang>!)?:/;
let bump = 'patch';
const reasons = [];
for (const { subject, body } of commits) {
  const match = HEADER.exec(subject);
  const type = match?.groups?.type ?? '';
  const breaking = Boolean(match?.groups?.bang) || /^BREAKING[ -]CHANGE:/m.test(body);
  if (breaking) {
    bump = 'major';
    reasons.push(`major  ${subject}`);
  } else if (type === 'feat' && bump !== 'major') {
    bump = 'minor';
    reasons.push(`minor  ${subject}`);
  }
}

let major = Number(currentMatch[1]);
let minor = Number(currentMatch[2]);
let patch = Number(currentMatch[3]);

// Pre-1.0 policy (RELEASING.md): breaking changes ship in a minor release.
if (!currentPrerelease && bump === 'major' && major === 0) {
  console.log('Pre-1.0: mapping major (breaking) bump to a minor release.');
  bump = 'minor';
}
let next = requestedVersion;
if (!next && currentPrerelease) {
  next = `${major}.${minor}.${patch}`;
  bump = 'promote';
} else if (!next) {
  if (bump === 'major') {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (bump === 'minor') {
    minor += 1;
    patch = 0;
  } else {
    patch += 1;
  }
  next = `${major}.${minor}.${patch}`;
}
if (next === current) {
  console.error(`Requested version ${next} is already current.`);
  process.exit(1);
}

console.log(`Commits since ${lastTag}: ${commits.length}`);
for (const reason of reasons.slice(0, 5)) console.log(`  ${reason}`);
console.log(`Version: ${current} → ${next}${requestedVersion ? ' (explicit)' : ` (${bump})`}`);

if (dryRun) {
  console.log('Dry run — no files changed.');
  process.exit(0);
}

// --- apply to package manifests ----------------------------------------------
const manifests = [
  'package.json',
  'packages/core/package.json',
  'packages/react/package.json',
  'packages/demo/package.json'
];
for (const file of manifests) {
  const pkg = JSON.parse(readFileSync(file, 'utf8'));
  pkg.version = next;
  if (pkg.dependencies?.['@richly/core']) pkg.dependencies['@richly/core'] = `^${next}`;
  writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log(`✓ ${file}`);
}

// --- roll the changelog --------------------------------------------------
const today = new Date().toISOString().slice(0, 10);
let changelog = readFileSync('CHANGELOG.md', 'utf8');
if (!changelog.includes('## [Unreleased]')) {
  console.error('CHANGELOG.md has no [Unreleased] section; add one before releasing.');
  process.exit(1);
}
changelog = changelog.replace('## [Unreleased]', `## [Unreleased]\n\n## [${next}] - ${today}`);
changelog = changelog.replace(
  /\[Unreleased\]: .*compare\/v[^\s]+\.\.\.HEAD/,
  `[Unreleased]: https://github.com/sanoopbhaskerv/richly/compare/v${next}...HEAD\n` +
    `[${next}]: https://github.com/sanoopbhaskerv/richly/compare/${lastTag}...v${next}`
);
writeFileSync('CHANGELOG.md', changelog);
console.log('✓ CHANGELOG.md');

console.log(`\nNext steps (RELEASING.md): review the diff, run "yarn release:check",`);
console.log(`open a release PR, then tag v${next} on the merged commit.`);

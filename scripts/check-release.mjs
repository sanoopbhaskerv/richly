import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const fail = (message) => {
  console.error(`Release check failed: ${message}`);
  process.exitCode = 1;
};

const rootPackage = readJson('package.json');
const core = readJson('packages/core/package.json');
const react = readJson('packages/react/package.json');
const demo = readJson('packages/demo/package.json');
const semver =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

if (!semver.test(core.version)) fail(`@richly/core has invalid SemVer version "${core.version}"`);
if (core.version !== react.version)
  fail(`package versions differ: core=${core.version}, react=${react.version}`);
if (rootPackage.version !== core.version)
  fail(`root version ${rootPackage.version} does not match package version ${core.version}`);
if (demo.version !== core.version)
  fail(`demo version ${demo.version} does not match package version ${core.version}`);
if (react.dependencies?.['@richly/core'] !== `^${core.version}`)
  fail(`@richly/react must depend on @richly/core using ^${core.version}`);
if (process.env.GITHUB_REF_TYPE === 'tag' && process.env.GITHUB_REF_NAME !== `v${core.version}`)
  fail(`tag ${process.env.GITHUB_REF_NAME} must match package version v${core.version}`);

// TODO(image-packages-publish): when image packages go public, add validation
// here for each one: version must match @richly/core version, private must be
// false, publishConfig.access must be 'public', and repository/homepage/bugs
// metadata must be declared. Also extend the published-text legacy-name check
// to include their README.md and LICENSE files.
for (const [name, pkg] of [
  ['@richly/core', core],
  ['@richly/react', react]
]) {
  if (pkg.name !== name) fail(`expected package name ${name}, received ${pkg.name}`);
  if (pkg.private) fail(`${name} must not be private`);
  if (pkg.publishConfig?.access !== 'public') fail(`${name} publishConfig.access must be public`);
  if (!pkg.repository?.url) fail(`${name} must declare repository metadata`);
  if (!pkg.homepage) fail(`${name} must declare a homepage`);
  if (!pkg.bugs?.url) fail(`${name} must declare an issue tracker`);
}

if (!read('CHANGELOG.md').includes(`## [${core.version}]`))
  fail(`CHANGELOG.md has no section for ${core.version}`);

const publishedText = [
  read('README.md'),
  read('packages/core/README.md'),
  read('packages/react/README.md'),
  read('packages/core/LICENSE'),
  read('packages/react/LICENSE')
].join('\n');
for (const legacy of ['@sb/', 'SB Editor', 'tinymce', 'TinyMCE']) {
  if (publishedText.includes(legacy)) fail(`published files still contain legacy name "${legacy}"`);
}

if (!process.exitCode) console.log(`Release metadata is consistent for Richly ${core.version}.`);

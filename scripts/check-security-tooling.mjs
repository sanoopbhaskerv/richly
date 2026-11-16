import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const parserRequire = createRequire(require.resolve('@typescript-eslint/typescript-estree'));
const { minimatch } = parserRequire('minimatch');
const { version } = parserRequire('minimatch/package.json');
// Temporary scoped resolution: typescript-estree only uses this public function
// with { dot: true }. Do not broaden to consumers of removed minimatch 10 APIs.
assert.equal(version, '11.0.8');
for (const [file, pattern, expected] of [
  ['config.ts', '*.ts', true],
  ['src/config.ts', '*.ts', false],
  ['src/config.ts', 'src/*.ts', true],
  ['src/.config.ts', 'src/*.ts', true],
  ['src/config.js', 'src/*.ts', false],
  ['src/deep/config.ts', 'src/**/*.ts', true],
  ['src/config.ts', 'src/*.{ts,js}', true]
]) {
  assert.equal(minimatch(file, pattern, { dot: true }), expected, `${file}: ${pattern}`);
}
console.log('Patched parser glob dependency and compatibility checks passed.');

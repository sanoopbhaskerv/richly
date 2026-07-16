/**
 * Guards the architectural boundary approved in
 * docs/image-studio/architecture.md §1: the image engine must stay usable
 * without React and without the Richly editor, so it can run in workers,
 * Node tooling, or non-Richly hosts. A manifest edit or a stray import that
 * violates this would silently couple the engine to a UI framework, so both
 * the manifest and the source tree are checked.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Vitest runs with the package directory as cwd (`yarn workspace <name> test`).
// `import.meta.url` is unusable here: the jsdom environment rewrites it to an
// http:// URL, which fileURLToPath rejects.
const packageRoot = process.cwd();
const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));

const FORBIDDEN = ['react', 'react-dom', '@richly/core', '@richly/react'];

/** Recursively collects TypeScript sources so new files are checked automatically. */
function collectSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return collectSources(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

/** Extracts static import/export specifiers; enough for a boundary tripwire. */
function importSpecifiers(source: string): string[] {
  return [...source.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1] ?? '');
}

describe('@richly/image-core dependency boundaries', () => {
  it('remains a private, unversioned scaffold until the release migration', () => {
    expect(manifest.private).toBe(true);
    expect(manifest.version).toBe('0.0.0');
  });

  it('declares no dependency on React or the Richly editor', () => {
    for (const section of ['dependencies', 'devDependencies', 'peerDependencies']) {
      const declared = Object.keys(manifest[section] ?? {});
      for (const forbidden of FORBIDDEN) {
        expect(declared, `${section} must not contain ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  it('imports nothing from React or the Richly editor', () => {
    for (const file of collectSources(join(packageRoot, 'src'))) {
      const specifiers = importSpecifiers(readFileSync(file, 'utf8'));
      for (const specifier of specifiers) {
        for (const forbidden of FORBIDDEN) {
          const violates = specifier === forbidden || specifier.startsWith(`${forbidden}/`);
          expect(violates, `${file} must not import ${specifier}`).toBe(false);
        }
      }
    }
  });
});

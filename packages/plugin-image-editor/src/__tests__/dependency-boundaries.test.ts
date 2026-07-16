/**
 * Guards the architectural boundary approved in
 * docs/image-studio/architecture.md §§1 and 16: the plugin bridges the
 * framework-agnostic Richly core to a host-provided image editor. It must
 * peer-depend on @richly/core (attach to the host's editor, never bundle a
 * second copy) and must not couple to React or @richly/react so vanilla and
 * React hosts share one bridge.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Vitest runs with the package directory as cwd (`yarn workspace <name> test`).
// `import.meta.url` is unusable here: the jsdom environment rewrites it to an
// http:// URL, which fileURLToPath rejects.
const packageRoot = process.cwd();
const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));

const FORBIDDEN = ['react', 'react-dom', '@richly/react'];

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

describe('@richly/plugin-image-editor dependency boundaries', () => {
  it('remains a private, unversioned scaffold until the release migration', () => {
    expect(manifest.private).toBe(true);
    expect(manifest.version).toBe('0.0.0');
  });

  it('peer-depends on @richly/core without bundling it', () => {
    expect(manifest.peerDependencies).toHaveProperty('@richly/core');
    expect(manifest.dependencies ?? {}).not.toHaveProperty('@richly/core');
  });

  it('declares no dependency on React or @richly/react', () => {
    for (const section of ['dependencies', 'devDependencies', 'peerDependencies']) {
      const declared = Object.keys(manifest[section] ?? {});
      for (const forbidden of FORBIDDEN) {
        expect(declared, `${section} must not contain ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  it('imports nothing from React, @richly/react, or the Image Studio UI', () => {
    // The studio must stay host-injected (lazy-loadable), so even the
    // image-studio main entry is forbidden here; only types/controller
    // wiring supplied by the host will cross this boundary in PR 7.
    const forbiddenImports = [...FORBIDDEN, '@richly/image-studio'];
    for (const file of collectSources(join(packageRoot, 'src'))) {
      for (const specifier of importSpecifiers(readFileSync(file, 'utf8'))) {
        for (const forbidden of forbiddenImports) {
          const violates = specifier === forbidden || specifier.startsWith(`${forbidden}/`);
          expect(violates, `${file} must not import ${specifier}`).toBe(false);
        }
      }
    }
  });
});

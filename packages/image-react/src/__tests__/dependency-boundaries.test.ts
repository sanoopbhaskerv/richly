/**
 * Guards the architectural boundary approved in
 * docs/image-studio/architecture.md §1: React bindings may depend on the
 * image engine, but React itself must remain a peer (hosts own the React
 * instance), and nothing here may couple to the Richly editor packages —
 * editor integration belongs to @richly/plugin-image-editor.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Vitest runs with the package directory as cwd (`yarn workspace <name> test`).
// `import.meta.url` is unusable here: the jsdom environment rewrites it to an
// http:// URL, which fileURLToPath rejects.
const packageRoot = process.cwd();
const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));

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

describe('@richly/image-react dependency boundaries', () => {
  it('remains a private, unversioned scaffold until the release migration', () => {
    expect(manifest.private).toBe(true);
    expect(manifest.version).toBe('0.0.0');
  });

  it('treats React and React DOM strictly as peer dependencies', () => {
    expect(Object.keys(manifest.peerDependencies ?? {})).toEqual(
      expect.arrayContaining(['react', 'react-dom'])
    );
    // Bundling React as a regular dependency would risk duplicate React
    // copies in host applications.
    expect(manifest.dependencies ?? {}).not.toHaveProperty('react');
    expect(manifest.dependencies ?? {}).not.toHaveProperty('react-dom');
  });

  it('may depend on the image engine but never on the Richly editor', () => {
    expect(manifest.dependencies).toHaveProperty('@richly/image-core');
    for (const section of ['dependencies', 'devDependencies', 'peerDependencies']) {
      const declared = Object.keys(manifest[section] ?? {});
      expect(declared, `${section} must not contain @richly/core`).not.toContain('@richly/core');
      expect(declared, `${section} must not contain @richly/react`).not.toContain('@richly/react');
    }
  });

  it('imports nothing from the Richly editor packages', () => {
    for (const file of collectSources(join(packageRoot, 'src'))) {
      for (const specifier of importSpecifiers(readFileSync(file, 'utf8'))) {
        for (const forbidden of ['@richly/core', '@richly/react']) {
          const violates = specifier === forbidden || specifier.startsWith(`${forbidden}/`);
          expect(violates, `${file} must not import ${specifier}`).toBe(false);
        }
      }
    }
  });
});

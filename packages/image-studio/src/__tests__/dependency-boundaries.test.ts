/**
 * Guards the architectural boundaries approved in
 * docs/image-studio/architecture.md §§1 and 14: the Studio composes the image
 * engine and React primitives (React itself stays a peer), it never touches
 * the Richly editor packages, and its `./controller` subpath must remain
 * importable without React.
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

describe('@richly/image-studio dependency boundaries', () => {
  it('remains a private, unversioned scaffold until the release migration', () => {
    expect(manifest.private).toBe(true);
    expect(manifest.version).toBe('0.0.0');
  });

  it('treats React and React DOM strictly as peer dependencies', () => {
    expect(Object.keys(manifest.peerDependencies ?? {})).toEqual(
      expect.arrayContaining(['react', 'react-dom'])
    );
    expect(manifest.dependencies ?? {}).not.toHaveProperty('react');
    expect(manifest.dependencies ?? {}).not.toHaveProperty('react-dom');
  });

  it('depends on the image packages but never on the Richly editor', () => {
    expect(manifest.dependencies).toHaveProperty('@richly/image-core');
    expect(manifest.dependencies).toHaveProperty('@richly/image-react');
    for (const section of ['dependencies', 'devDependencies', 'peerDependencies']) {
      const declared = Object.keys(manifest[section] ?? {});
      expect(declared, `${section} must not contain @richly/core`).not.toContain('@richly/core');
      expect(declared, `${section} must not contain @richly/react`).not.toContain('@richly/react');
    }
  });

  it('publishes a dedicated controller subpath in the export map', () => {
    // The React-free controller entry is a hard packaging requirement
    // (architecture.md §14); losing it would force hosts to bundle React.
    expect(manifest.exports).toHaveProperty(['./controller']);
  });

  it('keeps the controller entry free of React imports', () => {
    const controllerSource = readFileSync(join(packageRoot, 'src/controller.ts'), 'utf8');
    for (const specifier of importSpecifiers(controllerSource)) {
      expect(
        specifier === 'react' || specifier.startsWith('react-dom'),
        `controller.ts must not import ${specifier}`
      ).toBe(false);
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

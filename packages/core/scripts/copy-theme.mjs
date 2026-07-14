import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

await mkdir('dist', { recursive: true });

const entryPath = resolve('src/ui/theme.css');
const manifest = await readFile(entryPath, 'utf8');
const partialPaths = [...manifest.matchAll(/@import\s+['"](.+?)['"]\s*;/g)].map((match) =>
  resolve(dirname(entryPath), match[1])
);

if (partialPaths.length === 0) {
  throw new Error('src/ui/theme.css must import at least one theme partial');
}

// Inline the ordered source partials so the public package keeps one
// dependency-free stylesheet and consumers make no additional CSS requests.
const theme = (await Promise.all(partialPaths.map((path) => readFile(path, 'utf8')))).join('');
await writeFile('dist/theme.css', theme);

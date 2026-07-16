/**
 * Runs a package script across every Yarn 1 workspace that defines it,
 * in dependency order.
 *
 * Why this exists: the root `build`/`test`/`size:check` scripts used to
 * hard-code `yarn workspace @richly/core …` chains. Every new package meant
 * editing the root manifest, and nothing guaranteed that a dependency was
 * built before its dependents. This script discovers workspaces from the
 * root `workspaces` globs, topologically sorts them by their in-repo
 * dependency edges, and runs the requested script only where it is defined.
 *
 * Usage:
 *   node scripts/run-workspaces.mjs <script> [--ignore <workspace-name>]...
 *
 * `--ignore` exists so application workspaces (the demos) can be excluded
 * from library-oriented root scripts such as `build` without inventing a
 * custom package.json marker field. Demos are ignored by name, not by
 * `private: true`, because the unreleased image packages are also private
 * yet must participate in builds and tests.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

/** Reads and parses a JSON file, returning `null` when it does not exist. */
function readJson(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8'));
}

/**
 * Expands the root `workspaces` configuration into workspace directories.
 *
 * Yarn 1 accepts either an array of globs or `{ packages: [...] }`; both are
 * supported here so a future lint/nohoist migration does not silently break
 * discovery. Only the `<dir>/*` glob form and literal paths are handled —
 * that matches Yarn 1's practical usage in this repository, and failing loudly
 * on anything fancier is safer than mis-expanding it.
 */
function discoverWorkspaceDirs(rootManifest) {
  const patterns = Array.isArray(rootManifest.workspaces)
    ? rootManifest.workspaces
    : (rootManifest.workspaces?.packages ?? []);

  const dirs = [];
  for (const pattern of patterns) {
    if (pattern.includes('**') || (pattern.includes('*') && !pattern.endsWith('/*'))) {
      throw new Error(`Unsupported workspaces glob "${pattern}" (only "<dir>/*" is supported).`);
    }
    if (pattern.endsWith('/*')) {
      const base = join(repoRoot, pattern.slice(0, -2));
      if (!existsSync(base)) continue;
      for (const entry of readdirSync(base, { withFileTypes: true })) {
        if (entry.isDirectory()) dirs.push(join(base, entry.name));
      }
    } else {
      dirs.push(join(repoRoot, pattern));
    }
  }
  return dirs.filter((dir) => existsSync(join(dir, 'package.json')));
}

/**
 * Orders workspaces so every package runs after the workspaces it depends on.
 *
 * Edges include `peerDependencies` on purpose: a peer such as
 * `@richly/plugin-image-editor` → `@richly/core` produces no runtime bundle
 * edge, but type generation (tsup dts) resolves the peer's declaration files,
 * so the peer must already be built. Kahn's algorithm with an alphabetically
 * sorted ready-queue keeps the order deterministic across machines.
 */
function sortByDependencies(workspaces) {
  const names = new Set(workspaces.map((ws) => ws.name));
  const remainingDeps = new Map();
  const dependents = new Map();

  for (const ws of workspaces) {
    const sections = [
      'dependencies',
      'devDependencies',
      'peerDependencies',
      'optionalDependencies'
    ];
    const localDeps = new Set();
    for (const section of sections) {
      for (const dep of Object.keys(ws.manifest[section] ?? {})) {
        if (names.has(dep) && dep !== ws.name) localDeps.add(dep);
      }
    }
    remainingDeps.set(ws.name, localDeps);
    for (const dep of localDeps) {
      if (!dependents.has(dep)) dependents.set(dep, new Set());
      dependents.get(dep).add(ws.name);
    }
  }

  const byName = new Map(workspaces.map((ws) => [ws.name, ws]));
  const ready = workspaces
    .filter((ws) => remainingDeps.get(ws.name).size === 0)
    .map((ws) => ws.name)
    .sort();
  const ordered = [];

  while (ready.length > 0) {
    const name = ready.shift();
    ordered.push(byName.get(name));
    for (const dependent of [...(dependents.get(name) ?? [])].sort()) {
      const deps = remainingDeps.get(dependent);
      deps.delete(name);
      // Insert-sorted so ties always resolve alphabetically, keeping CI logs
      // and local runs byte-for-byte comparable.
      if (deps.size === 0) {
        ready.push(dependent);
        ready.sort();
      }
    }
  }

  if (ordered.length !== workspaces.length) {
    const stuck = workspaces.filter((ws) => !ordered.includes(ws)).map((ws) => ws.name);
    throw new Error(`Workspace dependency cycle involving: ${stuck.join(', ')}`);
  }
  return ordered;
}

function parseArgs(argv) {
  const ignored = new Set();
  let scriptName = null;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--ignore') {
      const value = argv[i + 1];
      if (!value) throw new Error('--ignore requires a workspace name.');
      ignored.add(value);
      i += 1;
    } else if (scriptName === null) {
      scriptName = arg;
    } else {
      throw new Error(`Unexpected argument "${arg}".`);
    }
  }
  if (!scriptName) {
    throw new Error('Usage: node scripts/run-workspaces.mjs <script> [--ignore <workspace>]...');
  }
  return { scriptName, ignored };
}

function main() {
  const { scriptName, ignored } = parseArgs(process.argv.slice(2));
  const rootManifest = readJson(join(repoRoot, 'package.json'));
  const workspaces = discoverWorkspaceDirs(rootManifest).map((dir) => {
    const manifest = readJson(join(dir, 'package.json'));
    return { name: manifest.name, dir, manifest };
  });

  const runnable = sortByDependencies(workspaces).filter(
    (ws) => !ignored.has(ws.name) && typeof ws.manifest.scripts?.[scriptName] === 'string'
  );

  if (runnable.length === 0) {
    console.warn(`No workspace defines a "${scriptName}" script; nothing to run.`);
    return;
  }

  for (const ws of runnable) {
    console.log(`\n▶ ${ws.name} — ${scriptName}`);
    const result = spawnSync('yarn', ['workspace', ws.name, 'run', scriptName], {
      cwd: repoRoot,
      stdio: 'inherit',
      // Yarn ships as a .cmd shim on Windows, which spawnSync only resolves
      // through a shell.
      shell: process.platform === 'win32'
    });
    if (result.status !== 0) {
      console.error(`\n✖ ${ws.name} "${scriptName}" failed with exit code ${result.status}.`);
      process.exit(result.status ?? 1);
    }
  }
}

main();

import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

const cache = resolve(tmpdir(), 'richly-npm-cache');

for (const packagePath of ['./packages/core', './packages/react']) {
  const result = spawnSync('npm', ['pack', '--dry-run', packagePath], {
    stdio: 'inherit',
    env: { ...process.env, npm_config_cache: cache }
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

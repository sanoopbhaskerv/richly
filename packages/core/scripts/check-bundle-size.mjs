import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const KIBIBYTE = 1024;
const packageRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

/**
 * Production-transfer budgets for the public core assets.
 *
 * Keep enough headroom for small fixes while requiring an explicit review for
 * feature-driven growth. Both JavaScript formats share a limit so CommonJS
 * cannot silently diverge from the browser-first ESM distribution.
 */
const budgets = [
  { label: 'Core ESM', relativePath: 'dist/index.js', maximumGzipBytes: 47 * KIBIBYTE },
  { label: 'Core CommonJS', relativePath: 'dist/index.cjs', maximumGzipBytes: 47 * KIBIBYTE },
  { label: 'Core theme', relativePath: 'dist/theme.css', maximumGzipBytes: 9 * KIBIBYTE }
];

/** Format bytes as a stable binary-size value for local and CI output. */
function formatKibibytes(bytes) {
  return `${(bytes / KIBIBYTE).toFixed(2)} KiB`;
}

let exceeded = false;
for (const budget of budgets) {
  const assetPath = resolve(packageRoot, budget.relativePath);
  if (!existsSync(assetPath)) {
    throw new Error(
      `Missing ${budget.relativePath}. Run "yarn workspace @richly/core build" before checking bundle size.`
    );
  }

  // Level 9 makes measurements deterministic across local builds and CI. The
  // budget represents transfer size, not the uncompressed npm artifact size.
  const gzipBytes = gzipSync(readFileSync(assetPath), { level: 9 }).byteLength;
  const withinBudget = gzipBytes <= budget.maximumGzipBytes;
  const marker = withinBudget ? 'PASS' : 'FAIL';
  console.log(
    `${marker} ${budget.label}: ${formatKibibytes(gzipBytes)} gzip / ${formatKibibytes(budget.maximumGzipBytes)} budget`
  );

  if (!withinBudget) {
    exceeded = true;
    console.error(
      `  ${budget.relativePath} exceeds its gzip budget by ${formatKibibytes(gzipBytes - budget.maximumGzipBytes)}.`
    );
  }
}

if (exceeded) {
  console.error(
    'Bundle-size check failed. Reduce the asset or document and review a budget change.'
  );
  process.exitCode = 1;
}

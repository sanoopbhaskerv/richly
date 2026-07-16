import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The engine must stay renderable off the DOM (workers later), so tests
    // run in Node until an implementation genuinely needs browser APIs.
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/**/__tests__/**']
      // No thresholds yet: the package is scaffolding-only. Thresholds arrive
      // with the first real implementation (PR 2) so they measure behavior,
      // not placeholder constants.
    }
  }
});

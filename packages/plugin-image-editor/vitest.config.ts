import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The plugin's scaffolding needs no DOM. When editor integration tests
    // arrive (PR 7) this switches to jsdom alongside a @richly/core devDep.
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/**/__tests__/**']
      // Thresholds intentionally deferred until the real plugin exists (PR 7).
    }
  }
});

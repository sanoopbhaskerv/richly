import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@richly/core': new URL('../core/src/index.ts', import.meta.url).pathname,
      '@richly/image-core': new URL('../image-core/src/index.ts', import.meta.url).pathname
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/**/__tests__/**']
      // Thresholds intentionally deferred until the real plugin exists (PR 7).
    }
  }
});

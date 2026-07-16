import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      // Resolve the workspace engine to its TypeScript source so `yarn test`
      // never requires a prior `@richly/image-core` build. Builds still verify
      // the real dist wiring via tsup's dts resolution.
      '@richly/image-core': fileURLToPath(new URL('../image-core/src/index.ts', import.meta.url))
    }
  },
  test: {
    // React bindings will exercise DOM APIs (canvas hosts, pointer events).
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/**/__tests__/**']
      // Thresholds intentionally deferred until real components exist (PR 5).
    }
  }
});

import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      // Resolve workspace siblings to TypeScript sources so `yarn test` never
      // requires prior builds. Builds still verify real dist wiring via tsup.
      '@richly/image-core': fileURLToPath(new URL('../image-core/src/index.ts', import.meta.url)),
      '@richly/image-react': fileURLToPath(new URL('../image-react/src/index.ts', import.meta.url))
    }
  },
  test: {
    // The Studio is a visual composition layer; its tests will render DOM.
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/**/__tests__/**']
      // Thresholds intentionally deferred until the real UI exists (PR 6).
    }
  }
});

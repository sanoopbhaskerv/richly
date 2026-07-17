import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@richly/image-core': fileURLToPath(new URL('../image-core/src/index.ts', import.meta.url))
    }
  },
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/**/__tests__/**']
    }
  }
});

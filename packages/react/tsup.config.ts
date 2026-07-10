import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  clean: true,
  dts: true,
  format: ['esm', 'cjs'],
  sourcemap: true,
  target: 'es2020',
  treeshake: true,
  external: ['react', 'react-dom', '@richly/core']
});

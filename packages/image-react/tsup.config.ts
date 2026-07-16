import { defineConfig } from 'tsup';

// Mirrors @richly/react's build: peers and the workspace engine stay external
// so hosts always get one React instance and one shared engine copy.
export default defineConfig({
  entry: ['src/index.ts'],
  clean: true,
  dts: true,
  format: ['esm', 'cjs'],
  sourcemap: true,
  target: 'es2020',
  treeshake: true,
  external: ['react', 'react-dom', '@richly/image-core']
});

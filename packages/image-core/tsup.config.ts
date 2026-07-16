import { defineConfig } from 'tsup';

// Mirrors @richly/core's build settings: the image engine is a leaf library
// with no runtime dependencies, so everything can be minified and tree-shaken.
export default defineConfig({
  entry: ['src/index.ts'],
  clean: true,
  dts: true,
  format: ['esm', 'cjs'],
  minify: true,
  sourcemap: true,
  target: 'es2020',
  treeshake: true
});

import { defineConfig } from 'tsup';

// LiteRT.js is intentionally not statically imported. Hosts opt in by
// installing @litertjs/core and passing runtime/model URLs at the boundary.
export default defineConfig({
  entry: ['src/index.ts'],
  clean: true,
  dts: true,
  format: ['esm', 'cjs'],
  sourcemap: true,
  target: 'es2020',
  treeshake: true,
  external: ['@richly/image-core', '@litertjs/core']
});

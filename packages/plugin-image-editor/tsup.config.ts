import { defineConfig } from 'tsup';

// @richly/core stays external because it is a peer dependency: the plugin
// must attach to the host application's editor instance, never a second copy.
export default defineConfig({
  entry: ['src/index.ts'],
  clean: true,
  dts: true,
  format: ['esm', 'cjs'],
  minify: true,
  sourcemap: true,
  target: 'es2020',
  treeshake: true,
  external: ['@richly/core']
});

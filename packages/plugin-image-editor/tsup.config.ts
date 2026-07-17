import { defineConfig } from 'tsup';

// @richly/core and @richly/image-core stay external because they are peer
// dependencies: the plugin must attach to the host application's editor and
// image engine instances, never bundle second copies.
export default defineConfig({
  entry: ['src/index.ts'],
  clean: true,
  dts: true,
  format: ['esm', 'cjs'],
  minify: true,
  sourcemap: true,
  target: 'es2020',
  treeshake: true,
  external: ['@richly/core', '@richly/image-core']
});

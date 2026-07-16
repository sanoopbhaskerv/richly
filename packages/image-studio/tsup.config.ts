import { defineConfig } from 'tsup';

// Two build entries on purpose (architecture.md §14): `controller` is a
// dedicated React-free subpath so hosts can create/open the programmatic
// controller without pulling the React UI into their bundle. A single entry
// relying on tree-shaking was explicitly rejected.
export default defineConfig({
  entry: ['src/index.ts', 'src/controller.ts'],
  clean: true,
  dts: true,
  format: ['esm', 'cjs'],
  sourcemap: true,
  target: 'es2020',
  treeshake: true,
  external: ['react', 'react-dom', '@richly/image-core', '@richly/image-react']
});

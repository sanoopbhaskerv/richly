import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // Resolve workspace packages to TypeScript sources (same pattern as
      // @richly/demo) so the dev server works without prior library builds.
      // Sub-path aliases MUST come before their bare package aliases:
      // regex $ anchors prevent prefix-matching bleed-through.
      {
        find: /^@richly\/core\/theme\.css$/,
        replacement: path.resolve(__dirname, '../core/src/ui/theme.css')
      },
      {
        find: /^@richly\/core$/,
        replacement: path.resolve(__dirname, '../core/src/index.ts')
      },
      {
        find: /^@richly\/plugin-image-editor$/,
        replacement: path.resolve(__dirname, '../plugin-image-editor/src/index.ts')
      },
      {
        find: /^@richly\/image-studio\/controller$/,
        replacement: path.resolve(__dirname, '../image-studio/src/controller.ts')
      },
      {
        find: /^@richly\/image-studio$/,
        replacement: path.resolve(__dirname, '../image-studio/src/index.ts')
      },
      {
        find: /^@richly\/image-react$/,
        replacement: path.resolve(__dirname, '../image-react/src/index.ts')
      },
      {
        find: /^@richly\/image-core$/,
        replacement: path.resolve(__dirname, '../image-core/src/index.ts')
      }
    ]
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        'richly-integration': path.resolve(__dirname, 'richly-integration/index.html')
      }
    }
  }
});

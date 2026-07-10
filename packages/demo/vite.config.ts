import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Point straight at the TypeScript source so Vite compiles it on-the-fly.
      // Any edit to packages/core/src/** or packages/react/src/** will hot-reload
      // instantly — no manual `yarn build` needed during development.
      '@sb/editor-core': path.resolve(__dirname, '../core/src/index.ts'),
      '@sb/editor-core/theme.css': path.resolve(__dirname, '../core/src/ui/theme.css'),
      '@sb/editor-react': path.resolve(__dirname, '../react/src/index.ts'),
    }
  }
});

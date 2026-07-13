import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Project Pages serve from /<repo>/ — set GH_PAGES=true only in that build.
  base: process.env.GH_PAGES ? '/richly/' : '/',
  plugins: [react()],
  resolve: {
    alias: [
      // CSS sub-path MUST come before the bare package alias.
      // Using regex with $ anchor to prevent prefix-matching bleed-through.
      {
        find: /^@richly\/core\/theme\.css$/,
        replacement: path.resolve(__dirname, '../core/src/ui/theme.css')
      },
      {
        find: /^@richly\/core$/,
        replacement: path.resolve(__dirname, '../core/src/index.ts')
      },
      {
        find: /^@richly\/react$/,
        replacement: path.resolve(__dirname, '../react/src/index.ts')
      }
    ]
  }
});

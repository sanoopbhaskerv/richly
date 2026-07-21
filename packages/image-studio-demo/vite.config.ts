import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const liteRtWasmDir = path.resolve(__dirname, '../../node_modules/@litertjs/core/wasm');
const liteRtWasmRoute = '/litert/wasm/';

function liteRtWasmAssets(): Plugin {
  return {
    name: 'richly-demo-litert-wasm-assets',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (!request.url?.startsWith(liteRtWasmRoute)) {
          next();
          return;
        }
        const assetName = decodeURIComponent(request.url.slice(liteRtWasmRoute.length));
        const assetPath = path.resolve(liteRtWasmDir, assetName);
        if (!assetPath.startsWith(liteRtWasmDir) || !fs.existsSync(assetPath)) {
          response.statusCode = 404;
          response.end();
          return;
        }
        response.setHeader(
          'content-type',
          assetName.endsWith('.wasm') ? 'application/wasm' : 'text/javascript'
        );
        fs.createReadStream(assetPath).pipe(response);
      });
    },
    generateBundle() {
      if (!fs.existsSync(liteRtWasmDir)) return;
      for (const file of fs.readdirSync(liteRtWasmDir)) {
        const assetPath = path.join(liteRtWasmDir, file);
        if (!fs.statSync(assetPath).isFile()) continue;
        this.emitFile({
          type: 'asset',
          fileName: `litert/wasm/${file}`,
          source: fs.readFileSync(assetPath)
        });
      }
    }
  };
}

export default defineConfig({
  plugins: [react(), liteRtWasmAssets()],
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
        find: /^@richly\/image-ai-litert$/,
        replacement: path.resolve(__dirname, '../image-ai-litert/src/index.ts')
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

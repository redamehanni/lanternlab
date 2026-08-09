import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { labServer } from './server/labServer';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [react(), labServer()],
  // 5174 = admin-web, 8081 = Metro mobile, 4000 = backend
  server: { port: 5175, host: true },
  optimizeDeps: {
    exclude: ['canvaskit-wasm'],
    include: ['canvaskit-wasm/bin/full/canvaskit.js'],
  },
  resolve: {
    alias: {
      'canvaskit-wasm/bin/full/canvaskit.js': resolve(
        __dirname,
        'node_modules/canvaskit-wasm/bin/full/canvaskit.js',
      ),
    },
  },
});

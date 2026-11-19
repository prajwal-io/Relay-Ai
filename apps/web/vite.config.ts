import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const apiData = resolve(dirname(fileURLToPath(import.meta.url)), '../api/data');
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/v1': {
        target: 'http://127.0.0.1:4317',
        changeOrigin: true,
        configure(proxy) {
          // Browser-origin CORS is unnecessary on this same-origin dev proxy.
          proxy.on('proxyReq', (request) => {
            request.removeHeader('origin');
            try {
              const token = readFileSync(resolve(apiData, 'relay-development.token'), 'utf8').trim();
              if (/^[a-f0-9]{64}$/.test(token)) request.setHeader('authorization', `Bearer ${token}`);
            } catch { /* API startup creates the development credential. */ }
          });
        },
      },
    },
  },
});

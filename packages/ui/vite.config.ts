import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // dev server → local API server
      '/api': 'http://127.0.0.1:5980',
    },
  },
  build: {
    outDir: 'dist',
    // one predictable bundle; the local server serves this directory
    chunkSizeWarningLimit: 1500,
  },
});

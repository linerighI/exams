import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'schoolsync',
  base: './',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5181,
    strictPort: true,
    proxy: { '/api/console': { target: 'http://127.0.0.1:4325' } },
  },
  build: {
    outDir: 'dist-console',
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'server-console.html'),
    },
  },
});

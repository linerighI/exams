import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiPort = Number(process.env.SCHOOLSYNC_API_PORT || 4320);
const webPort = Number(process.env.SCHOOLSYNC_WEB_PORT || 5180);

export default defineConfig({
  root: 'schoolsync',
  base: './',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: webPort,
    strictPort: true,
    proxy: { '/api': { target: `http://127.0.0.1:${apiPort}`, ws: true } },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const module = id.replace(/\\/g, '/');
          if (!module.includes('/node_modules/')) return;
          if (/\/(motion|motion-dom|motion-utils|framer-motion|gsap)\//.test(module))
            return 'animation';
          if (/\/three\//.test(module)) return 'three';
          if (/\/(react|react-dom|scheduler)\//.test(module)) return 'react';
        },
      },
    },
  },
});

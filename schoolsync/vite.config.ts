import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  root: 'schoolsync',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5180,
    strictPort: true,
    proxy: { '/api': { target: 'http://127.0.0.1:4320', ws: true } },
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
          if (/\/(react|react-dom|scheduler)\//.test(module)) return 'react';
        },
      },
    },
  },
});

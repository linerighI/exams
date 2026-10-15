import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    watch: {
      ignored: [
        '**/worker/**',
        '**/.data/**',
        '**/release/**',
        '**/test-results/**',
        '**/desktop/*.cjs',
        '**/build/**',
      ],
    },
    port: Number(process.env.SCHOOL_UI_PORT || 5173),
    strictPort: true,
    proxy: { '/api': `http://127.0.0.1:${process.env.SCHOOL_API_PORT || 4310}` },
  },
  build: { outDir: 'dist' },
});

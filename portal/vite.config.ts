import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('./client', import.meta.url)),
  plugins: [react()],
  build: { outDir: '../dist', emptyOutDir: true },
  server: {
    fs: {
      allow: [
        fileURLToPath(new URL('./client', import.meta.url)),
        fileURLToPath(new URL('./node_modules', import.meta.url)),
      ],
      deny: ['**/.env*', '**/.data/**', '**/server/**', '**/.git/**'],
    },
  },
});

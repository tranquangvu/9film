import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

const API_TARGET = process.env.API_URL ?? 'http://localhost:8081';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      '/hls': { target: API_TARGET, changeOrigin: true },
    },
  },
});

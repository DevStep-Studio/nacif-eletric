import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'error',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'html2canvas': path.resolve(__dirname, './node_modules/html2canvas/dist/html2canvas.js'),
    },
  },
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/app-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const sourceName = assetInfo.names?.[0] || 'asset'
          return sourceName.endsWith('.css') ? 'assets/app-[hash].css' : 'assets/[name]-[hash][extname]'
        },
      },
    },
  },
});

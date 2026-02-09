import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
     
      babel: {
        plugins: [['babel-plugin-react-compiler', { target: '18' }]],
      },
    }),
  ],
  worker: {
    // Optimization: Useful if you move GeoJSON parsing to a Web Worker
    format: 'es',
  },
  build: {
    // Optimization: Mapping libraries are heavy. 
    // This splits them into separate files so the initial load is faster.
    rollupOptions: {
      output: {
        manualChunks: {
          'mapping-engine': ['deck.gl', '@deck.gl/layers', 'maplibre-gl'],
          'react-vendor': ['react', 'react-dom'],
        },
      },
    },
    // Ensures the production build is as small as possible
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Cleans up your logs for production
      },
    },
  },
  // Fix for potential "Top-level await" issues with some mapping data loaders
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext',
    },
  },
});
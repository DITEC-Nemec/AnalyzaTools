import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Builduje dva samostatné entry pointy:
// - algorithm  → dist/algorithm/index.{js,css}
// - domainModel → dist/domainModel/index.{js,css}

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        algorithm:   resolve(__dirname, 'src/algorithm/index.html'),
        domainModel: resolve(__dirname, 'src/domainModel/index.html')
      },
      output: {
        entryFileNames: '[name]/index.js',
        chunkFileNames: '[name]/[name].js',
        assetFileNames: (info) => {
          if (info.name?.endsWith('.css')) { return '[name]/index.css'; }
          return 'assets/[name][extname]';
        }
      }
    }
  }
});

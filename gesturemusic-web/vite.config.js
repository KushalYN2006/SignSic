import { defineConfig } from 'vite';
import { cpSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

const localVisionAssets = () => ({
  name: 'copy-local-vision-assets',
  buildStart() {
    const packageWasm = resolve('node_modules/@mediapipe/tasks-vision/wasm');
    const publicWasm = resolve('public/models/wasm');
    if (existsSync(packageWasm)) {
      mkdirSync(publicWasm, { recursive: true });
      cpSync(packageWasm, publicWasm, { recursive: true });
    }
  },
});

export default defineConfig(({ mode }) => ({
  // GitHub Pages hosts this project beneath /SignSic/. Keep local Vite URLs
  // rooted at / for the normal development workflow.
  base: mode === 'production' ? '/SignSic/' : '/',
  plugins: [localVisionAssets(), {
    name: 'github-pages-spa-fallback',
    closeBundle() {
      copyFileSync(resolve('dist/index.html'), resolve('dist/404.html'));
    },
  }],
  server: { strictPort: true },
  esbuild: { jsx: 'automatic' },
  // The workspace is inside a synced Windows folder. Avoid esbuild's automatic
  // directory crawl there; Vite can transform imported modules on demand.
  optimizeDeps: {
    noDiscovery: true,
    include: ['react', 'react-dom/client', 'react-router-dom', 'tone', '@mediapipe/tasks-vision'],
  },
}));

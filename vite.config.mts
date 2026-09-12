import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Renderer build configuration. The renderer lives in src/renderer and is
// loaded via file:// in the packaged app, so base is set to './' to keep
// asset paths relative.
export default defineConfig({
  root: 'src/renderer',
  base: './',
  plugins: [react()],
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
  },
});

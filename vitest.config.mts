import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Vitest configuration split into two projects:
// - node: pure engine and shared logic tests run in a Node environment.
// - jsdom: React component tests run in a jsdom environment with the
//   testing-library setup file loaded.
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['tests/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          include: ['tests/**/*.test.tsx'],
          setupFiles: ['tests/setup.ts'],
        },
      },
    ],
  },
});

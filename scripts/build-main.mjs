// Bundles the Electron main and preload processes with esbuild.
// Output goes to dist/main/index.js and dist/preload/index.js as CommonJS,
// with electron marked external (it is provided by the Electron runtime).
import { build } from 'esbuild';

const shared = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  sourcemap: true,
  external: ['electron'],
  logLevel: 'info',
};

async function run() {
  await Promise.all([
    build({
      ...shared,
      entryPoints: ['src/main/index.ts'],
      outfile: 'dist/main/index.js',
    }),
    build({
      ...shared,
      entryPoints: ['src/preload/index.ts'],
      outfile: 'dist/preload/index.js',
    }),
  ]);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

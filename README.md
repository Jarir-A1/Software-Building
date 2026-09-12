# WordSetu

WordSetu is a production-ready, offline Bangla dictionary desktop application
for Windows 11. It is built with Electron, a TypeScript main and preload layer,
and a React renderer bundled by Vite. The Windows installer is produced with
electron-builder (NSIS).

This repository is under active development. FEAT-001 establishes the project
scaffold, a strict toolchain, and a green baseline (typecheck, lint, test,
build). The dictionary engine, full UI, and Windows packaging are added in
later features.

## Requirements

- Node.js 20 or newer (the development sandbox uses Node 22)
- npm 10 or newer

## Install

```bash
npm install
```

If the Electron binary is missing after install (some environments skip the
npm postinstall step), fetch it explicitly:

```bash
node node_modules/electron/install.js
```

## Common scripts

| Script                  | Description                                            |
| ----------------------- | ------------------------------------------------------ |
| `npm run typecheck`     | Type-check the whole project with `tsc --noEmit`.      |
| `npm run lint`          | Lint TypeScript and TSX sources with ESLint.           |
| `npm run format`        | Format the codebase with Prettier.                     |
| `npm test`              | Run the Vitest unit and component test suites.         |
| `npm run build`         | Type-check and build main, preload, and renderer.      |
| `npm run dev`           | Start the Vite dev server and launch Electron.         |
| `npm run start`         | Launch Electron against the built output.              |
| `npm run package:linux` | Build a Linux package (proves the packaging pipeline). |
| `npm run package:win`   | Build the Windows NSIS installer (run on Windows).     |

## Build output

`npm run build` produces:

- `dist/main/index.js` - the bundled Electron main process
- `dist/preload/index.js` - the bundled preload script
- `dist/renderer/` - the compiled React renderer, including `index.html`

## Notes on the development sandbox

The build and test toolchain runs on Linux. The Electron main process boots
headless in the sandbox; a live GUI window requires a display server, so the
renderer is validated through Vitest with jsdom rather than a real window.
The native Windows `.exe` is produced with `npm run package:win` on a Windows
runner, wired in a later feature.

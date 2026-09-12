# WordSetu

WordSetu is a production ready, fully offline Bangla dictionary desktop
application for Windows 11. It is built with Electron, a strict TypeScript main
and preload layer, and a modern React renderer bundled by Vite. The customer
facing Windows installer is a single NSIS `.exe` produced with electron-builder.

WordSetu is designed to be friendly for both beginners and expert users: fast
incremental search, Latin to Bangla phonetic input, rich word detail, favorites,
history, a word of the day, light and dark themes, and full keyboard control.

## Feature overview

- **Instant offline search.** No network required. The dictionary data ships
  inside the app, so it works on a plane, on a train, or on a locked down
  machine.
- **Phonetic (Avro style) input.** Type Bangla using the Latin alphabet and see
  the transliterated Bangla candidate as you type.
- **Script auto detection.** Search using Bangla script or English glosses; the
  engine matches across headwords, romanization, and definitions.
- **Autocomplete with keyboard navigation.** Debounced suggestions, arrow keys
  to move, Enter to select, Esc to dismiss.
- **Rich word detail.** Headword, romanization, IPA, part of speech, all senses
  (Bangla and English), example sentences, synonyms, and antonyms.
- **Fuzzy "did you mean" suggestions** when a query has no exact match.
- **Favorites** that persist across restarts.
- **Search history** with one click re run and clear all.
- **Word of the Day** plus a "surprise me" random word.
- **Text to speech** for supported platforms (feature detected, hidden when the
  Web Speech API is unavailable).
- **Copy to clipboard** for any headword or gloss.
- **Light, dark, and system themes** with a proper Bangla capable font stack.
- **Settings** for theme, font size, phonetic input, and clearing history.
- **Full keyboard shortcuts:** `/` or `Ctrl+F` focuses search, `Ctrl+,` opens
  settings, `Ctrl+D` toggles favorite on the open word, `Esc` closes menus.

## Tech stack and architecture

WordSetu follows Electron security best practices with a strict process split.

| Layer               | Technology                          | Responsibility                                                              |
| ------------------- | ----------------------------------- | --------------------------------------------------------------------------- |
| Main process        | Electron + TypeScript               | App lifecycle, secure window, native menu, IPC handlers, data loading.      |
| Dictionary engine   | Pure TypeScript (no framework)      | Search, suggestions, fuzzy matching, phonetic transliteration. Unit tested. |
| Persistence         | JSON store in `app.getPath('userData')` | Settings, favorites, and history.                                       |
| Preload bridge      | `contextBridge` typed API           | Exposes only `window.wordsetu`; no raw `ipcRenderer` or Node in the renderer. |
| Renderer            | React 18 + Vite                     | The full UI: search, results, detail, favorites, history, settings.         |
| Data                | Offline JSON in `resources/dictionary` | The bundled dictionary corpus, shipped as an extra resource.             |

Security posture: `contextIsolation: true`, `nodeIntegration: false`,
`sandbox: true`. All main and renderer communication goes through a typed
`ipcRenderer.invoke` / `ipcMain.handle` bridge exposed as `window.wordsetu`.

Project layout:

```
src/main        Electron main process, dictionary engine, JSON store
src/preload     contextBridge typed API (window.wordsetu)
src/renderer    React application (components, theme, hooks, styles)
src/shared      API types and constants shared across processes
resources/dictionary  Offline dictionary data, schema, and data license
build           App icons and packaging assets
scripts         Build and icon generation scripts
tests           Vitest unit and component tests
.github/workflows  Windows installer CI
```

## Prerequisites

- Node.js 20 or newer (Node 22 is used in CI and development).
- npm 10 or newer.
- Windows 11 is required only to build the final `.exe` locally (see below).
  Development, testing, and the Linux packaging proof run on any OS.

## Development

```bash
npm ci
npm run dev
```

`npm run dev` starts the Vite dev server and launches Electron against it.

If the Electron binary is missing after install (some environments skip the npm
postinstall step), fetch it explicitly:

```bash
node node_modules/electron/install.js
```

## Quality gates

All three must pass before packaging:

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # vitest run
```

## Build

Compile the main, preload, and renderer bundles into `dist/`:

```bash
npm run build
```

This produces:

- `dist/main/index.js` - the bundled Electron main process
- `dist/preload/index.js` - the bundled preload script
- `dist/renderer/` - the compiled React renderer including `index.html`

## Package for Windows 11

The customer facing artifact is a single NSIS installer named
`WordSetu-Setup-<version>.exe`. Build it **on a Windows 11 machine** (or on the
GitHub Actions `windows-latest` runner described below), because a native
Windows `.exe` cannot be produced on the Linux development sandbox.

Run these exact commands on Windows 11:

```bash
npm ci
npm run build
npm run package:win
```

`npm run package:win` is equivalent to running `npx electron-builder --win nsis`
after the build. It writes the installer to:

```
release/WordSetu-Setup-<version>.exe
```

For example, at version `0.1.0` the file is
`release/WordSetu-Setup-0.1.0.exe`.

### How a customer installs it

1. Double click `WordSetu-Setup-<version>.exe`.
2. The NSIS installer opens. Because `oneClick` is disabled, the customer can
   choose the installation directory.
3. The installer creates a Desktop shortcut and a Start Menu shortcut, both
   named **WordSetu**.
4. Launch WordSetu from either shortcut. The dictionary works fully offline.

To uninstall, use "Apps and features" in Windows Settings or the WordSetu entry
in "Programs and Features".

### Build the installer with GitHub Actions instead

The workflow at [`.github/workflows/build-windows.yml`](.github/workflows/build-windows.yml)
runs on `windows-latest`. On push to `main`/`master`, on a `v*` tag, or via
manual dispatch it runs `typecheck`, `lint`, `test`, and `build`, then
`npx electron-builder --win nsis --publish never`, and finally uploads
`release/*.exe` as a downloadable workflow artifact. This is the recommended way
to produce the `.exe` if you do not have a Windows machine handy.

## Building on Linux (pipeline proof)

The development sandbox runs on Linux, so it cannot emit a Windows `.exe`
without wine. To prove the entire packaging pipeline works, build the Linux
target instead:

```bash
npm run package:linux
```

This runs `electron-builder --linux dir` and produces
`release/linux-unpacked/` containing the `wordsetu` binary. The bundled
dictionary is copied to
`release/linux-unpacked/resources/resources/dictionary/`, which is exactly the
path the main process resolver reads at runtime. This confirms that the same
electron-builder configuration, the same `extraResources` mapping, and the same
data resolution logic used for the Windows build all work end to end.

## Code signing

The Windows build is currently **unsigned**. Unsigned installers trigger a
Windows SmartScreen warning until the publisher builds reputation or uses a
trusted code signing certificate. Signing hooks are wired as documented
placeholders so they can be enabled without restructuring the build:

- In [`electron-builder.yml`](electron-builder.yml), the `win` block has a
  commented `certificateFile` / `certificatePassword` example and notes the
  `CSC_LINK` / `CSC_KEY_PASSWORD` environment variables that electron-builder
  reads automatically.
- In [`.github/workflows/build-windows.yml`](.github/workflows/build-windows.yml),
  the packaging step has a commented `env` block showing where to inject
  `CSC_LINK` and `CSC_KEY_PASSWORD` from repository secrets.

To sign, provide a valid `.pfx` certificate (as a file or base64 secret) and its
password, then uncomment the relevant block. No other changes are required.

## Dictionary data and licensing

- **Code** is licensed under the MIT License. See [`LICENSE`](LICENSE).
- **Seed dictionary data** in `resources/dictionary/entries.json` is original
  content released into the public domain under Creative Commons CC0 1.0. See
  [`resources/dictionary/LICENSE-DATA.md`](resources/dictionary/LICENSE-DATA.md)
  for the full dedication, the data schema notes, and an expansion path for
  adding openly licensed corpora (for example IndoWordNet or Wiktionary) with
  the required attribution and share alike handling.
- The data schema is documented in
  [`resources/dictionary/SCHEMA.md`](resources/dictionary/SCHEMA.md).

## Scripts reference

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
| `npm run package:win`   | Build the Windows NSIS installer (run on Windows 11).  |

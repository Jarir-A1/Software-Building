// Electron main process entry point for WordSetu.
// Creates the primary application window using secure defaults and loads the
// React renderer. During development the renderer is served by Vite; in a
// packaged build it is loaded from the bundled file on disk.
import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { APP_NAME, DEV_SERVER_ENV } from '../shared/constants';

// Resolve the preload script relative to the bundled main file. The esbuild
// output places main at dist/main/index.js and preload at dist/preload/index.js.
const preloadPath = path.join(__dirname, '..', 'preload', 'index.js');

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 800,
    minHeight: 560,
    title: APP_NAME,
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.once('ready-to-show', () => {
    window.show();
  });

  const devServerUrl = process.env[DEV_SERVER_ENV];
  if (devServerUrl) {
    void window.loadURL(devServerUrl);
  } else {
    const rendererIndex = path.join(__dirname, '..', 'renderer', 'index.html');
    void window.loadFile(rendererIndex);
  }

  return window;
}

app.whenReady().then(() => {
  // Emitted once Electron has finished initialization. Used as the headless
  // smoke-test signal on CI/sandbox environments without a display.
  console.log(`${APP_NAME} main process ready`);
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

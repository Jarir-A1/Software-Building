// Electron main process entry point for WordSetu.
//
// Responsibilities:
//   - Enforce a single application instance.
//   - Load the bundled offline dictionary once on startup (resolving the data
//     path for both development and the packaged app).
//   - Construct the DictionaryEngine and the persistent Store.
//   - Register all ipcMain.handle channels bridging the renderer to the engine
//     and the store.
//   - Create a secure BrowserWindow (contextIsolation, no nodeIntegration,
//     sandbox) and load the React renderer.
//   - Build the native application menu with standard roles plus WordSetu
//     specific actions that are relayed to the renderer.
import { app, BrowserWindow, ipcMain, Menu, shell, type MenuItemConstructorOptions } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { APP_NAME, APP_VERSION, DEV_SERVER_ENV } from '../shared/constants';
import { IPC, MENU_ACTION_CHANNEL, type MenuAction, type Settings } from '../shared/api';
import { DictionaryEngine } from './dictionary/engine';
import { loadDictionary } from './dictionary/loader';
import { Store } from './store';

const preloadPath = path.join(__dirname, '..', 'preload', 'index.js');

// Resolves the dictionary data file for both dev and packaged builds. In a
// packaged app the resources/ folder is copied to process.resourcesPath (via
// electron-builder extraResources, configured in FEAT-004). In dev/tests the
// file lives under the project's resources/ directory. We probe a small set of
// candidate locations and use the first that exists.
function resolveDictionaryPath(): string {
  const candidates = [
    path.join(process.resourcesPath ?? '', 'dictionary', 'entries.json'),
    path.join(process.resourcesPath ?? '', 'resources', 'dictionary', 'entries.json'),
    path.join(app.getAppPath(), 'resources', 'dictionary', 'entries.json'),
    path.join(__dirname, '..', '..', 'resources', 'dictionary', 'entries.json'),
    path.join(process.cwd(), 'resources', 'dictionary', 'entries.json'),
  ];
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  // Fall back to the project-relative path so the error message is actionable.
  return candidates[candidates.length - 1];
}

// Loads and indexes the dictionary, constructing the engine. Logs the entry
// count as the headless smoke-test signal.
function createEngine(): DictionaryEngine {
  const dataPath = resolveDictionaryPath();
  const raw = fs.readFileSync(dataPath, 'utf-8');
  const indexes = loadDictionary(raw);
  console.log(`${APP_NAME}: loaded ${indexes.entries.length} dictionary entries from ${dataPath}`);
  return new DictionaryEngine(indexes);
}

let mainWindow: BrowserWindow | null = null;

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1180,
    height: 800,
    minWidth: 860,
    minHeight: 580,
    title: APP_NAME,
    backgroundColor: '#0f1115',
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

  // Open external links in the user's browser rather than a new Electron window.
  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
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

// Sends a menu-driven action to the focused renderer.
function dispatchMenuAction(action: MenuAction): void {
  const target = BrowserWindow.getFocusedWindow() ?? mainWindow;
  target?.webContents.send(MENU_ACTION_CHANNEL, action);
}

function buildMenu(): void {
  const isMac = process.platform === 'darwin';

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: APP_NAME,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [isMac ? { role: 'close' } : { role: 'quit' }],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        {
          label: 'Find',
          accelerator: 'CmdOrCtrl+F',
          click: () => dispatchMenuAction('focus-search'),
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Theme',
          accelerator: 'CmdOrCtrl+Shift+L',
          click: () => dispatchMenuAction('toggle-theme'),
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => dispatchMenuAction('open-settings'),
        },
      ],
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'zoom' }, ...(isMac ? [] : [{ role: 'close' as const }])],
    },
    {
      role: 'help',
      submenu: [
        {
          label: `About ${APP_NAME}`,
          click: () => dispatchMenuAction('show-about'),
        },
        {
          label: 'Learn More',
          click: () => {
            void shell.openExternal('https://www.unicode.org/charts/PDF/U0980.pdf');
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// Registers every IPC channel. The engine and store are captured in the
// closure so handlers stay thin.
function registerIpc(engine: DictionaryEngine, store: Store): void {
  ipcMain.handle(IPC.dictSearch, (_event, query: string, options) =>
    engine.search(query, options),
  );
  ipcMain.handle(IPC.dictSuggest, (_event, prefix: string, limit?: number) =>
    engine.suggest(prefix, limit),
  );
  ipcMain.handle(IPC.dictGetById, (_event, id: string) => engine.getById(id) ?? null);
  ipcMain.handle(IPC.dictWordOfTheDay, (_event, dateKey?: string) =>
    engine.wordOfTheDay(dateKey) ?? null,
  );
  ipcMain.handle(IPC.dictRandom, () => engine.random() ?? null);

  ipcMain.handle(IPC.storeGetSettings, () => store.getSettings());
  ipcMain.handle(IPC.storeSetSettings, (_event, patch: Partial<Settings>) =>
    store.setSettings(patch),
  );

  ipcMain.handle(IPC.favList, () => store.listFavorites());
  ipcMain.handle(IPC.favToggle, (_event, id: string) => store.toggleFavorite(id));

  ipcMain.handle(IPC.historyList, () => store.listHistory());
  ipcMain.handle(IPC.historyAdd, (_event, query: string) => store.addHistory(query));
  ipcMain.handle(IPC.historyClear, () => store.clearHistory());
}

// Single instance lock: a second launch focuses the existing window instead of
// starting a new process.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    // Startup log used as the headless smoke-test signal in the sandbox.
    console.log(`${APP_NAME} v${APP_VERSION} main process ready`);

    const engine = createEngine();
    const store = new Store();
    registerIpc(engine, store);
    buildMenu();

    mainWindow = createMainWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createMainWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}

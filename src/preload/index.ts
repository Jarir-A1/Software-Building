// Preload script for WordSetu.
//
// Runs in an isolated context (contextIsolation: true) and exposes a single
// typed API object, window.wordsetu, to the renderer via the contextBridge.
// The renderer never receives ipcRenderer, the Node process, or any other
// privileged object: every capability is a narrow method that wraps exactly
// one ipcRenderer.invoke (or a guarded event subscription).
import { contextBridge, ipcRenderer } from 'electron';
import { APP_NAME, APP_VERSION } from '../shared/constants';
import {
  IPC,
  MENU_ACTION_CHANNEL,
  type DictionaryEntry,
  type HistoryItem,
  type MenuAction,
  type SearchOptions,
  type SearchResult,
  type Settings,
  type WordSetuApi,
} from '../shared/api';

const api: WordSetuApi = {
  appName: APP_NAME,
  appVersion: APP_VERSION,

  search: (query: string, options?: SearchOptions): Promise<SearchResult[]> =>
    ipcRenderer.invoke(IPC.dictSearch, query, options),
  suggest: (prefix: string, limit?: number): Promise<DictionaryEntry[]> =>
    ipcRenderer.invoke(IPC.dictSuggest, prefix, limit),
  getById: (id: string): Promise<DictionaryEntry | null> =>
    ipcRenderer.invoke(IPC.dictGetById, id),
  wordOfTheDay: (dateKey?: string): Promise<DictionaryEntry | null> =>
    ipcRenderer.invoke(IPC.dictWordOfTheDay, dateKey),
  random: (): Promise<DictionaryEntry | null> => ipcRenderer.invoke(IPC.dictRandom),

  getSettings: (): Promise<Settings> => ipcRenderer.invoke(IPC.storeGetSettings),
  setSettings: (patch: Partial<Settings>): Promise<Settings> =>
    ipcRenderer.invoke(IPC.storeSetSettings, patch),

  listFavorites: (): Promise<string[]> => ipcRenderer.invoke(IPC.favList),
  toggleFavorite: (id: string): Promise<string[]> => ipcRenderer.invoke(IPC.favToggle, id),

  listHistory: (): Promise<HistoryItem[]> => ipcRenderer.invoke(IPC.historyList),
  addHistory: (query: string): Promise<HistoryItem[]> =>
    ipcRenderer.invoke(IPC.historyAdd, query),
  clearHistory: (): Promise<HistoryItem[]> => ipcRenderer.invoke(IPC.historyClear),

  onMenuAction: (handler: (action: MenuAction) => void): (() => void) => {
    const listener = (_event: unknown, action: MenuAction): void => handler(action);
    ipcRenderer.on(MENU_ACTION_CHANNEL, listener);
    return () => {
      ipcRenderer.removeListener(MENU_ACTION_CHANNEL, listener);
    };
  },
};

contextBridge.exposeInMainWorld('wordsetu', api);

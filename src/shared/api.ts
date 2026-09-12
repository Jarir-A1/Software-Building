// Shared type definitions for the typed bridge between the Electron main
// process and the React renderer. Both the preload (which wraps
// ipcRenderer.invoke) and the renderer (which consumes window.wordsetu) import
// these types so the IPC surface is fully typed end to end.
//
// This module must stay free of any Electron or Node runtime imports: it is
// type only and is bundled into both the preload and the renderer.

import type {
  DictionaryEntry,
  SearchOptions,
  SearchResult,
} from '../main/dictionary/types';

export type { DictionaryEntry, SearchOptions, SearchResult };

// The available theme modes. "system" follows the OS preference.
export type ThemeMode = 'light' | 'dark' | 'system';

// User configurable settings, persisted in the userData store.
export interface Settings {
  theme: ThemeMode;
  fontSize: number;
  phoneticInput: boolean;
  lastQuery: string;
}

// A single search history record.
export interface HistoryItem {
  query: string;
  timestamp: number;
}

// The IPC channel names. Kept as a const object so both sides reference the
// exact same strings and typos are caught at compile time.
export const IPC = {
  dictSearch: 'dict:search',
  dictSuggest: 'dict:suggest',
  dictGetById: 'dict:getById',
  dictWordOfTheDay: 'dict:wordOfTheDay',
  dictRandom: 'dict:random',
  storeGetSettings: 'store:getSettings',
  storeSetSettings: 'store:setSettings',
  favList: 'fav:list',
  favToggle: 'fav:toggle',
  historyList: 'history:list',
  historyAdd: 'history:add',
  historyClear: 'history:clear',
} as const;

// The typed API exposed to the renderer as window.wordsetu. Every method wraps
// a single ipcRenderer.invoke call and returns a promise.
export interface WordSetuApi {
  readonly appName: string;
  readonly appVersion: string;

  // Dictionary engine.
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  suggest(prefix: string, limit?: number): Promise<DictionaryEntry[]>;
  getById(id: string): Promise<DictionaryEntry | null>;
  wordOfTheDay(dateKey?: string): Promise<DictionaryEntry | null>;
  random(): Promise<DictionaryEntry | null>;

  // Settings.
  getSettings(): Promise<Settings>;
  setSettings(patch: Partial<Settings>): Promise<Settings>;

  // Favorites.
  listFavorites(): Promise<string[]>;
  toggleFavorite(id: string): Promise<string[]>;

  // History.
  listHistory(): Promise<HistoryItem[]>;
  addHistory(query: string): Promise<HistoryItem[]>;
  clearHistory(): Promise<HistoryItem[]>;

  // Renderer subscription to menu driven events (theme toggle, focus search,
  // open settings). Returns an unsubscribe function.
  onMenuAction(handler: (action: MenuAction) => void): () => void;
}

// Actions dispatched from the native application menu to the renderer.
export type MenuAction = 'toggle-theme' | 'focus-search' | 'open-settings' | 'show-about';

export const MENU_ACTION_CHANNEL = 'menu:action';

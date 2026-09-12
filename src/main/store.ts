// Persistent JSON store for WordSetu.
//
// Stores user settings, favorites, and search history in a single JSON file
// under Electron's userData directory. The store is deliberately small and
// dependency free: it reads and writes synchronously and always falls back to
// safe defaults when the file is missing or corrupt, so a bad write can never
// prevent the app from starting.

import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { HistoryItem, Settings } from '../shared/api';

// Maximum number of history items retained. Older items are dropped.
const HISTORY_CAP = 100;

// The complete persisted shape.
interface StoreData {
  settings: Settings;
  favorites: string[];
  history: HistoryItem[];
}

const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  fontSize: 16,
  phoneticInput: true,
  lastQuery: '',
};

function defaultData(): StoreData {
  return {
    settings: { ...DEFAULT_SETTINGS },
    favorites: [],
    history: [],
  };
}

// Coerces an unknown parsed value into a valid StoreData, filling in defaults
// for anything missing or malformed. This is what protects against corrupt
// files: no field is trusted without a type check.
function sanitize(raw: unknown): StoreData {
  const data = defaultData();
  if (typeof raw !== 'object' || raw === null) {
    return data;
  }
  const record = raw as Record<string, unknown>;

  const settings = record.settings;
  if (typeof settings === 'object' && settings !== null) {
    const s = settings as Record<string, unknown>;
    if (s.theme === 'light' || s.theme === 'dark' || s.theme === 'system') {
      data.settings.theme = s.theme;
    }
    if (typeof s.fontSize === 'number' && Number.isFinite(s.fontSize)) {
      data.settings.fontSize = Math.min(28, Math.max(12, Math.round(s.fontSize)));
    }
    if (typeof s.phoneticInput === 'boolean') {
      data.settings.phoneticInput = s.phoneticInput;
    }
    if (typeof s.lastQuery === 'string') {
      data.settings.lastQuery = s.lastQuery;
    }
  }

  if (Array.isArray(record.favorites)) {
    data.favorites = record.favorites.filter((v): v is string => typeof v === 'string');
  }

  if (Array.isArray(record.history)) {
    data.history = record.history
      .filter((v): v is Record<string, unknown> => typeof v === 'object' && v !== null)
      .filter((v) => typeof v.query === 'string' && typeof v.timestamp === 'number')
      .map((v) => ({ query: v.query as string, timestamp: v.timestamp as number }))
      .slice(0, HISTORY_CAP);
  }

  return data;
}

export class Store {
  private readonly filePath: string;
  private data: StoreData;

  constructor(filePath?: string) {
    this.filePath = filePath ?? path.join(app.getPath('userData'), 'wordsetu-store.json');
    this.data = this.read();
  }

  // Reads and sanitizes the store file. Never throws: on any error it returns
  // fresh defaults so the app can always start.
  private read(): StoreData {
    try {
      const text = fs.readFileSync(this.filePath, 'utf-8');
      return sanitize(JSON.parse(text));
    } catch {
      return defaultData();
    }
  }

  // Persists the current state. Errors are swallowed and logged so a failed
  // write never crashes the app.
  private write(): void {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (error) {
      console.error('WordSetu: failed to persist store', error);
    }
  }

  public getSettings(): Settings {
    return { ...this.data.settings };
  }

  public setSettings(patch: Partial<Settings>): Settings {
    this.data.settings = sanitize({
      settings: { ...this.data.settings, ...patch },
    }).settings;
    this.write();
    return this.getSettings();
  }

  public listFavorites(): string[] {
    return this.data.favorites.slice();
  }

  // Toggles a favorite id and returns the updated list.
  public toggleFavorite(id: string): string[] {
    const index = this.data.favorites.indexOf(id);
    if (index >= 0) {
      this.data.favorites.splice(index, 1);
    } else {
      this.data.favorites.unshift(id);
    }
    this.write();
    return this.listFavorites();
  }

  public listHistory(): HistoryItem[] {
    return this.data.history.slice();
  }

  // Records a query, de-duplicating consecutive/previous identical entries and
  // capping the list length. Returns the updated history.
  public addHistory(query: string): HistoryItem[] {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      return this.listHistory();
    }
    this.data.history = this.data.history.filter((item) => item.query !== trimmed);
    this.data.history.unshift({ query: trimmed, timestamp: Date.now() });
    if (this.data.history.length > HISTORY_CAP) {
      this.data.history = this.data.history.slice(0, HISTORY_CAP);
    }
    this.write();
    return this.listHistory();
  }

  public clearHistory(): HistoryItem[] {
    this.data.history = [];
    this.write();
    return this.listHistory();
  }
}

import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// The store imports 'electron' only for app.getPath default. We provide an
// explicit filePath in every test, but the import must still resolve, so mock
// the electron module in this node-environment test.
vi.mock('electron', () => ({
  app: { getPath: () => os.tmpdir() },
}));

// Imported after the mock is registered.
const { Store } = await import('../src/main/store');

function tempFile(): string {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wordsetu-')), 'store.json');
}

describe('Store', () => {
  const created: string[] = [];

  afterEach(() => {
    for (const file of created) {
      try {
        fs.rmSync(path.dirname(file), { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
    created.length = 0;
  });

  it('returns defaults when no file exists', () => {
    const file = tempFile();
    created.push(file);
    const store = new Store(file);
    const settings = store.getSettings();
    expect(settings.theme).toBe('system');
    expect(settings.fontSize).toBe(16);
    expect(settings.phoneticInput).toBe(true);
    expect(store.listFavorites()).toEqual([]);
    expect(store.listHistory()).toEqual([]);
  });

  it('persists settings and reloads them from disk', () => {
    const file = tempFile();
    created.push(file);
    new Store(file).setSettings({ theme: 'dark', fontSize: 20 });
    const reopened = new Store(file);
    expect(reopened.getSettings().theme).toBe('dark');
    expect(reopened.getSettings().fontSize).toBe(20);
  });

  it('clamps invalid font sizes into range', () => {
    const file = tempFile();
    created.push(file);
    const store = new Store(file);
    expect(store.setSettings({ fontSize: 999 }).fontSize).toBe(28);
    expect(store.setSettings({ fontSize: 1 }).fontSize).toBe(12);
  });

  it('toggles favorites on and off and persists them', () => {
    const file = tempFile();
    created.push(file);
    const store = new Store(file);
    expect(store.toggleFavorite('boi')).toEqual(['boi']);
    expect(store.toggleFavorite('ami')).toEqual(['ami', 'boi']);
    expect(store.toggleFavorite('boi')).toEqual(['ami']);
    expect(new Store(file).listFavorites()).toEqual(['ami']);
  });

  it('records history without duplicates, newest first', () => {
    const file = tempFile();
    created.push(file);
    const store = new Store(file);
    store.addHistory('boi');
    store.addHistory('ami');
    const list = store.addHistory('boi');
    expect(list.map((h) => h.query)).toEqual(['boi', 'ami']);
    expect(store.clearHistory()).toEqual([]);
  });

  it('falls back to defaults on a corrupt file', () => {
    const file = tempFile();
    created.push(file);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '{ this is not valid json', 'utf-8');
    const store = new Store(file);
    expect(store.getSettings().theme).toBe('system');
    expect(store.listFavorites()).toEqual([]);
  });
});

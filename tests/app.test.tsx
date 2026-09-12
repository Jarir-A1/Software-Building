import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from '../src/renderer/App';
import type { DictionaryEntry, SearchResult, Settings, WordSetuApi } from '../src/shared/api';

// A small set of fixture entries used by the mocked engine API.
const banglaEntry: DictionaryEntry = {
  id: 'boi',
  headword: 'বই',
  headwordRoman: 'boi',
  partOfSpeech: 'noun',
  pronunciationIPA: 'boi',
  senses: [{ definitionBn: 'পড়ার বস্তু', definitionEn: 'book' }],
  synonyms: ['পুস্তক'],
  examples: [{ bn: 'আমি বই পড়ি।', en: 'I read a book.' }],
};

const wotdEntry: DictionaryEntry = {
  id: 'ami',
  headword: 'আমি',
  headwordRoman: 'ami',
  senses: [{ definitionBn: 'নিজেকে বোঝায়', definitionEn: 'I' }],
};

const defaultSettings: Settings = {
  theme: 'light',
  fontSize: 16,
  phoneticInput: true,
  lastQuery: '',
};

// Builds a fully mocked window.wordsetu whose methods are vi.fn spies so tests
// can assert real API interaction (search called, fav:toggle called, etc.).
function installMockApi(overrides: Partial<WordSetuApi> = {}): WordSetuApi {
  let favorites: string[] = [];
  const api: WordSetuApi = {
    appName: 'WordSetu',
    appVersion: '0.1.0',
    search: vi.fn(
      async (): Promise<SearchResult[]> => [
        { entry: banglaEntry, matchType: 'exact', score: 1000 },
      ],
    ),
    suggest: vi.fn(async (): Promise<DictionaryEntry[]> => [banglaEntry]),
    getById: vi.fn(async (id: string) => (id === banglaEntry.id ? banglaEntry : null)),
    wordOfTheDay: vi.fn(async () => wotdEntry),
    random: vi.fn(async () => wotdEntry),
    getSettings: vi.fn(async () => ({ ...defaultSettings })),
    setSettings: vi.fn(async (patch) => ({ ...defaultSettings, ...patch })),
    listFavorites: vi.fn(async () => favorites.slice()),
    toggleFavorite: vi.fn(async (id: string) => {
      favorites = favorites.includes(id) ? favorites.filter((f) => f !== id) : [id, ...favorites];
      return favorites.slice();
    }),
    listHistory: vi.fn(async () => []),
    addHistory: vi.fn(async () => []),
    clearHistory: vi.fn(async () => []),
    onMenuAction: vi.fn(() => () => undefined),
    ...overrides,
  };
  Object.defineProperty(window, 'wordsetu', { value: api, configurable: true, writable: true });
  return api;
}

describe('App', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    cleanup();
    vi.restoreAllMocks();
  });

  it('loads settings and shows the word of the day on start', async () => {
    const api = installMockApi();
    render(<App />);
    await waitFor(() => expect(api.getSettings).toHaveBeenCalled());
    await waitFor(() => expect(api.wordOfTheDay).toHaveBeenCalled());
    expect(await screen.findByText('আমি')).toBeInTheDocument();
  });

  it('applies the persisted theme to the document root', async () => {
    const darkSettings: Settings = { ...defaultSettings, theme: 'dark' };
    installMockApi({ getSettings: vi.fn(async () => darkSettings) });
    render(<App />);
    await waitFor(() =>
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark'),
    );
  });

  it('calls the search API (debounced) as the user types and renders results', async () => {
    const api = installMockApi();
    render(<App />);
    await waitFor(() => expect(api.getSettings).toHaveBeenCalled());

    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'boi' } });
    // Submit to force a search run.
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(api.search).toHaveBeenCalledWith('boi', expect.anything()));
    expect(await screen.findByRole('heading', { name: 'বই' })).toBeInTheDocument();
    expect(api.addHistory).toHaveBeenCalledWith('boi');
  });

  it('shows a Bangla phonetic candidate for Latin input', async () => {
    installMockApi();
    render(<App />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'ami' } });
    expect(await screen.findByText('আমি')).toBeInTheDocument();
  });

  it('toggles a favorite via the fav:toggle API from the detail view', async () => {
    const api = installMockApi();
    render(<App />);
    await waitFor(() => expect(api.getSettings).toHaveBeenCalled());

    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'boi' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await screen.findByRole('heading', { name: 'বই' });

    const favButton = screen.getByRole('button', { name: /add to favorites/i });
    fireEvent.click(favButton);
    await waitFor(() => expect(api.toggleFavorite).toHaveBeenCalledWith('boi'));
  });
});

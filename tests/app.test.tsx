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

  it('renders a friendly error with retry when the search IPC rejects', async () => {
    const api = installMockApi({
      search: vi.fn(async () => {
        throw new Error('ipc failed');
      }),
    });
    render(<App />);
    await waitFor(() => expect(api.getSettings).toHaveBeenCalled());

    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'boi' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
    // It must not remain stuck on the loading state.
    expect(screen.queryByText('Searching…')).not.toBeInTheDocument();
    // The retry affordance re-runs the search.
    const retry = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retry);
    await waitFor(() => expect((api.search as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(1));
    // Let the debounced suggestion settle so its state update is flushed inside
    // act() and does not leak a warning past the end of the test.
    await waitFor(() => expect(api.suggest).toHaveBeenCalled());
    await screen.findByRole('option');
  });

  it('opens the keyboard shortcuts affordance and lists the wired shortcuts', async () => {
    installMockApi();
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /keyboard shortcuts/i }));

    const dialog = await screen.findByRole('dialog', { name: /keyboard shortcuts/i });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText(/focus the search box/i)).toBeInTheDocument();
    expect(screen.getByText(/open settings/i)).toBeInTheDocument();
    expect(screen.getByText(/toggle favorite/i)).toBeInTheDocument();
    expect(screen.getByText(/close dialogs/i)).toBeInTheDocument();
  });

  it('renders the onboarding hint on the home view and dismisses it', async () => {
    window.localStorage.clear();
    installMockApi();
    render(<App />);

    expect(await screen.findByText(/Welcome to WordSetu/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /got it/i }));
    await waitFor(() =>
      expect(screen.queryByText(/Welcome to WordSetu/i)).not.toBeInTheDocument(),
    );
  });
});

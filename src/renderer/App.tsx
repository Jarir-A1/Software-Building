import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
} from 'react';
import { APP_NAME } from '../shared/constants';
import type { DictionaryEntry, HistoryItem, Settings } from '../shared/api';
import { ThemeProvider } from './theme';
import SearchBar from './components/SearchBar';
import SearchResults from './components/SearchResults';
import FavoritesView from './components/FavoritesView';
import HistoryView from './components/HistoryView';
import WordOfTheDayView from './components/WordOfTheDayView';
import SettingsView from './components/SettingsView';
import WordDetail from './components/WordDetail';

type View = 'home' | 'search' | 'favorites' | 'history' | 'settings';

const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  fontSize: 16,
  phoneticInput: true,
  lastQuery: '',
};

const NAV: { view: View; label: string; icon: string }[] = [
  { view: 'home', label: 'Word of the Day', icon: '✨' },
  { view: 'search', label: 'Search', icon: '🔍' },
  { view: 'favorites', label: 'Favorites', icon: '★' },
  { view: 'history', label: 'History', icon: '🕑' },
  { view: 'settings', label: 'Settings', icon: '⚙' },
];

// Root application component. Owns the top-level app state (settings,
// favorites, history, current view, current query and opened entry), loads it
// from the store on mount, wires keyboard shortcuts and native menu actions,
// and renders the shell (sidebar + search bar + content area).
export default function App(): ReactElement {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [view, setView] = useState<View>('home');
  const [query, setQuery] = useState('');
  const [openedEntry, setOpenedEntry] = useState<DictionaryEntry | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Initial load of persisted state.
  useEffect(() => {
    void window.wordsetu.getSettings().then((loaded) => {
      setSettings(loaded);
      if (loaded.lastQuery) {
        setQuery(loaded.lastQuery);
      }
    });
    void window.wordsetu.listFavorites().then(setFavorites);
    void window.wordsetu.listHistory().then(setHistory);
  }, []);

  const persistSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
    void window.wordsetu.setSettings(patch).then(setSettings);
  }, []);

  const focusSearch = useCallback(() => {
    setView('search');
    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  }, []);

  const runSearch = useCallback((next: string) => {
    setQuery(next);
    setOpenedEntry(null);
    setView('search');
    const trimmed = next.trim();
    if (trimmed.length > 0) {
      void window.wordsetu.addHistory(trimmed).then(setHistory);
      void window.wordsetu.setSettings({ lastQuery: trimmed });
    }
  }, []);

  const openEntry = useCallback((entry: DictionaryEntry) => {
    setOpenedEntry(entry);
    setView('search');
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    void window.wordsetu.toggleFavorite(id).then(setFavorites);
  }, []);

  const clearHistory = useCallback(() => {
    void window.wordsetu.clearHistory().then(setHistory);
  }, []);

  // Native menu actions relayed from the main process.
  useEffect(() => {
    const unsubscribe = window.wordsetu.onMenuAction((action) => {
      if (action === 'toggle-theme') {
        persistSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' });
      } else if (action === 'focus-search') {
        focusSearch();
      } else if (action === 'open-settings') {
        setView('settings');
      } else if (action === 'show-about') {
        setShowAbout(true);
      }
    });
    return unsubscribe;
  }, [settings.theme, persistSettings, focusSearch]);

  // Global keyboard shortcuts.
  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      const typing =
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

      if ((event.key === '/' && !typing) || ((event.ctrlKey || event.metaKey) && event.key === 'f')) {
        event.preventDefault();
        focusSearch();
      } else if ((event.ctrlKey || event.metaKey) && event.key === ',') {
        event.preventDefault();
        setView('settings');
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
        if (openedEntry) {
          event.preventDefault();
          toggleFavorite(openedEntry.id);
        }
      } else if (event.key === 'Escape' && showAbout) {
        setShowAbout(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [focusSearch, openedEntry, toggleFavorite, showAbout]);

  return (
    <ThemeProvider
      mode={settings.theme}
      fontSize={settings.fontSize}
      onModeChange={(theme) => persistSettings({ theme })}
    >
      <div className="app">
        <aside className="sidebar">
          <div className="sidebar__brand">
            <span className="sidebar__logo">অ</span>
            <span className="sidebar__name">{APP_NAME}</span>
          </div>
          <nav className="sidebar__nav" aria-label="Primary">
            {NAV.map((item) => (
              <button
                key={item.view}
                type="button"
                className={`nav-item${view === item.view ? ' nav-item--active' : ''}`}
                aria-current={view === item.view ? 'page' : undefined}
                onClick={() => {
                  setView(item.view);
                  if (item.view === 'search') {
                    focusSearch();
                  }
                }}
              >
                <span className="nav-item__icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="sidebar__footer">
            <button type="button" className="btn btn--ghost" onClick={() => setShowAbout(true)}>
              About
            </button>
          </div>
        </aside>

        <div className="main">
          <header className="topbar">
            <SearchBar
              ref={searchInputRef}
              value={query}
              phoneticInput={settings.phoneticInput}
              onChange={setQuery}
              onSubmit={runSearch}
              onSelectEntry={(entry) => {
                setQuery(entry.headword);
                openEntry(entry);
                void window.wordsetu.addHistory(entry.headword).then(setHistory);
              }}
            />
          </header>

          <main className="content">
            {view === 'home' && (
              <WordOfTheDayView onOpen={openEntry} onRandom={openEntry} />
            )}
            {view === 'search' &&
              (openedEntry ? (
                <WordDetail
                  entry={openedEntry}
                  isFavorite={favorites.includes(openedEntry.id)}
                  onToggleFavorite={toggleFavorite}
                />
              ) : (
                <SearchResults
                  query={query}
                  favorites={favorites}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
            {view === 'favorites' && (
              <FavoritesView
                favorites={favorites}
                onOpen={openEntry}
                onToggleFavorite={toggleFavorite}
              />
            )}
            {view === 'history' && (
              <HistoryView history={history} onRerun={runSearch} onClear={clearHistory} />
            )}
            {view === 'settings' && (
              <SettingsView
                settings={settings}
                onChange={persistSettings}
                onClearHistory={clearHistory}
              />
            )}
          </main>
        </div>

        {showAbout && (
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={`About ${APP_NAME}`}
            onClick={() => setShowAbout(false)}
          >
            <div className="modal__card" onClick={(event) => event.stopPropagation()}>
              <h2>{APP_NAME}</h2>
              <p>A modern, offline Bangla dictionary for Windows 11.</p>
              <p className="modal__muted">Search Bangla and English, type phonetically, and save favorites, all offline.</p>
              <button type="button" className="btn btn--primary" onClick={() => setShowAbout(false)}>
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </ThemeProvider>
  );
}

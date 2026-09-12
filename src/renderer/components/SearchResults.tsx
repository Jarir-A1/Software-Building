import { useEffect, useState, type ReactElement } from 'react';
import type { DictionaryEntry, SearchResult } from '../../shared/api';
import WordDetail from './WordDetail';

interface SearchResultsProps {
  query: string;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
}

// Runs the engine search for the given query and renders the ranked results.
// The top result is shown as a full detail view; remaining results are a
// selectable list. Handles loading, empty, not-found (with did-you-mean), and
// error states (a rejected IPC promise degrades to a retryable message rather
// than leaving the UI stuck on "Searching…").
export default function SearchResults({
  query,
  favorites,
  onToggleFavorite,
}: SearchResultsProps): ReactElement {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [resolvedQuery, setResolvedQuery] = useState<string>('');
  const [selected, setSelected] = useState<DictionaryEntry | null>(null);
  const [error, setError] = useState(false);
  // Bumped by the retry button to re-run the current query after a failure.
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    const trimmed = query.trim();
    let cancelled = false;
    // Empty query resolves to no results; a real query hits the engine. Both
    // paths update state asynchronously (in the promise callback) so no
    // setState runs synchronously in the effect body. Any prior error is
    // cleared on success rather than eagerly in the effect body.
    const run =
      trimmed.length === 0
        ? Promise.resolve<SearchResult[]>([])
        : window.wordsetu.search(trimmed, { limit: 30 });
    void Promise.resolve(run).then(
      (items) => {
        if (!cancelled) {
          setError(false);
          setResults(items);
          setSelected(items[0]?.entry ?? null);
          setResolvedQuery(query);
        }
      },
      () => {
        if (!cancelled) {
          setError(true);
          setResults([]);
          setSelected(null);
          setResolvedQuery(query);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [query, retryToken]);

  // Loading is derived: results are stale until the resolved query matches the
  // current query.
  const loading = !error && query.trim().length > 0 && resolvedQuery !== query;

  if (query.trim().length === 0) {
    return (
      <div className="empty">
        <p className="empty__title">Start typing to search</p>
        <p className="empty__hint">
          Type Bangla directly, or type in Latin letters to transliterate.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty" role="alert" aria-live="assertive">
        <p className="empty__title">Something went wrong</p>
        <p className="empty__hint">The search could not be completed. Please try again.</p>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => setRetryToken((token) => token + 1)}
        >
          Retry
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="empty" role="status" aria-live="polite">
        Searching…
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="empty" role="status" aria-live="polite">
        <p className="empty__title">No results for “{query}”</p>
        <p className="empty__hint">Check the spelling or try a different word.</p>
      </div>
    );
  }

  const active = selected ?? results[0].entry;
  const fuzzyOnly = results.every((result) => result.matchType === 'fuzzy');

  return (
    <div className="results">
      {fuzzyOnly && (
        <p className="results__didyoumean">
          No exact match. Did you mean{' '}
          <button
            type="button"
            className="link-btn"
            lang="bn"
            onClick={() => setSelected(results[0].entry)}
          >
            {results[0].entry.headword}
          </button>
          ?
        </p>
      )}
      <div className="results__body">
        <ul className="results__list" aria-label="Search results">
          {results.map((result) => (
            <li key={result.entry.id}>
              <button
                type="button"
                className={`results__item${
                  result.entry.id === active.id ? ' results__item--active' : ''
                }`}
                onClick={() => setSelected(result.entry)}
              >
                <span className="results__head" lang="bn">
                  {result.entry.headword}
                </span>
                {result.entry.senses[0]?.definitionEn && (
                  <span className="results__gloss">{result.entry.senses[0].definitionEn}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
        <div className="results__detail">
          <WordDetail
            entry={active}
            isFavorite={favorites.includes(active.id)}
            onToggleFavorite={onToggleFavorite}
          />
        </div>
      </div>
    </div>
  );
}

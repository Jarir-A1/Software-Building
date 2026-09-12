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
// selectable list. Handles loading, empty, and not-found (with did-you-mean)
// states.
export default function SearchResults({
  query,
  favorites,
  onToggleFavorite,
}: SearchResultsProps): ReactElement {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [resolvedQuery, setResolvedQuery] = useState<string>('');
  const [selected, setSelected] = useState<DictionaryEntry | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    let cancelled = false;
    // Empty query resolves to no results; a real query hits the engine. Both
    // paths update state asynchronously (in the promise callback) so no
    // setState runs synchronously in the effect body.
    const run =
      trimmed.length === 0
        ? Promise.resolve<SearchResult[]>([])
        : window.wordsetu.search(trimmed, { limit: 30 });
    void Promise.resolve(run).then((items) => {
      if (!cancelled) {
        setResults(items);
        setSelected(items[0]?.entry ?? null);
        setResolvedQuery(query);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [query]);

  // Loading is derived: results are stale until the resolved query matches the
  // current query.
  const loading = query.trim().length > 0 && resolvedQuery !== query;

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

  if (loading) {
    return <div className="empty">Searching…</div>;
  }

  if (results.length === 0) {
    return (
      <div className="empty">
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

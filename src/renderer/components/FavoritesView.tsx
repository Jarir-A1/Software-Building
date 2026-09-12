import { useEffect, useState, type ReactElement } from 'react';
import type { DictionaryEntry } from '../../shared/api';

interface FavoritesViewProps {
  favorites: string[];
  onOpen: (entry: DictionaryEntry) => void;
  onToggleFavorite: (id: string) => void;
}

// Lists the persisted favorite entries, resolving ids to full entries via the
// engine. Each row opens the detail view or can be unfavorited in place.
export default function FavoritesView({
  favorites,
  onOpen,
  onToggleFavorite,
}: FavoritesViewProps): ReactElement {
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all(favorites.map((id) => window.wordsetu.getById(id))).then((results) => {
      if (!cancelled) {
        setEntries(results.filter((entry): entry is DictionaryEntry => entry !== null));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [favorites]);

  if (favorites.length === 0) {
    return (
      <div className="empty">
        <p className="empty__title">No favorites yet</p>
        <p className="empty__hint">Open a word and tap the star to save it here.</p>
      </div>
    );
  }

  return (
    <section aria-label="Favorites">
      <h2 className="view-title">Favorites</h2>
      <ul className="entry-list">
        {entries.map((entry) => (
          <li key={entry.id} className="entry-row">
            <button type="button" className="entry-row__main" onClick={() => onOpen(entry)}>
              <span className="entry-row__head" lang="bn">
                {entry.headword}
              </span>
              {entry.senses[0]?.definitionEn && (
                <span className="entry-row__gloss">{entry.senses[0].definitionEn}</span>
              )}
            </button>
            <button
              type="button"
              className="icon-btn icon-btn--active"
              aria-label={`Remove ${entry.headword} from favorites`}
              onClick={() => onToggleFavorite(entry.id)}
            >
              ★
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

import { useEffect, useState, type ReactElement } from 'react';
import type { DictionaryEntry } from '../../shared/api';

interface WordOfTheDayViewProps {
  onOpen: (entry: DictionaryEntry) => void;
  onRandom: (entry: DictionaryEntry) => void;
}

// The landing card: a deterministic word of the day plus a "surprise me"
// random word action. Both open the full detail view.
export default function WordOfTheDayView({
  onOpen,
  onRandom,
}: WordOfTheDayViewProps): ReactElement {
  const [entry, setEntry] = useState<DictionaryEntry | null>(null);

  useEffect(() => {
    let cancelled = false;
    void window.wordsetu.wordOfTheDay().then((result) => {
      if (!cancelled) {
        setEntry(result);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="wotd" aria-label="Word of the day">
      <h2 className="view-title">Word of the Day</h2>
      {entry ? (
        <div className="wotd__card">
          <p className="wotd__headword" lang="bn">
            {entry.headword}
          </p>
          {entry.headwordRoman && <p className="wotd__roman">{entry.headwordRoman}</p>}
          <p className="wotd__def" lang="bn">
            {entry.senses[0]?.definitionBn}
          </p>
          {entry.senses[0]?.definitionEn && (
            <p className="wotd__gloss">{entry.senses[0].definitionEn}</p>
          )}
          <div className="wotd__actions">
            <button type="button" className="btn btn--primary" onClick={() => onOpen(entry)}>
              View details
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                void window.wordsetu.random().then((random) => {
                  if (random) {
                    onRandom(random);
                  }
                });
              }}
            >
              Surprise me
            </button>
          </div>
        </div>
      ) : (
        <div className="wotd__card wotd__card--loading">Loading…</div>
      )}
    </section>
  );
}

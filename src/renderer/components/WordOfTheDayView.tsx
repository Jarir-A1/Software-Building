import { useEffect, useState, type ReactElement } from 'react';
import type { DictionaryEntry } from '../../shared/api';

interface WordOfTheDayViewProps {
  onOpen: (entry: DictionaryEntry) => void;
  onRandom: (entry: DictionaryEntry) => void;
}

// localStorage key marking that the first-run onboarding hint has been seen.
const ONBOARDING_KEY = 'wordsetu.onboardingDismissed';

function readOnboardingDismissed(): boolean {
  try {
    return window.localStorage.getItem(ONBOARDING_KEY) === '1';
  } catch {
    return false;
  }
}

// The landing card: a deterministic word of the day plus a "surprise me"
// random word action. Both open the full detail view. On first run it also
// shows a dismissible hint explaining phonetic typing and search.
export default function WordOfTheDayView({
  onOpen,
  onRandom,
}: WordOfTheDayViewProps): ReactElement {
  const [entry, setEntry] = useState<DictionaryEntry | null>(null);
  const [failed, setFailed] = useState(false);
  const [showHint, setShowHint] = useState(() => !readOnboardingDismissed());

  useEffect(() => {
    let cancelled = false;
    void window.wordsetu.wordOfTheDay().then(
      (result) => {
        if (!cancelled) {
          setEntry(result);
        }
      },
      () => {
        // A rejected IPC promise degrades to a neutral empty state.
        if (!cancelled) {
          setFailed(true);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const dismissHint = (): void => {
    setShowHint(false);
    try {
      window.localStorage.setItem(ONBOARDING_KEY, '1');
    } catch {
      // Persisting the dismissal is best-effort; ignore storage failures.
    }
  };

  return (
    <section className="wotd" aria-label="Word of the day">
      {showHint && (
        <div className="onboarding" role="note" aria-label="Getting started">
          <div className="onboarding__body">
            <p className="onboarding__title">Welcome to WordSetu</p>
            <p className="onboarding__text">
              Type in Latin letters to write Bangla phonetically, for example{' '}
              <code>ami</code> becomes <strong lang="bn">“আমি”</strong>. Press{' '}
              <kbd>/</kbd> to jump to the search box, then Enter to search.
            </p>
          </div>
          <button
            type="button"
            className="btn btn--ghost onboarding__dismiss"
            onClick={dismissHint}
          >
            Got it
          </button>
        </div>
      )}

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
                void window.wordsetu.random().then(
                  (random) => {
                    if (random) {
                      onRandom(random);
                    }
                  },
                  () => undefined,
                );
              }}
            >
              Surprise me
            </button>
          </div>
        </div>
      ) : failed ? (
        <div className="wotd__card wotd__card--loading">
          Word of the day is unavailable right now.
        </div>
      ) : (
        <div className="wotd__card wotd__card--loading">Loading…</div>
      )}
    </section>
  );
}

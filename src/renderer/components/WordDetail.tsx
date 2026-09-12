import { useCallback, useState, type ReactElement } from 'react';
import type { DictionaryEntry } from '../../shared/api';
import { useSpeechSupported } from '../hooks';

interface WordDetailProps {
  entry: DictionaryEntry;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
}

// Speaks a string using the Web Speech API in the given language, when
// supported. Callers gate the button on useSpeechSupported.
function speak(text: string, lang: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

// The full detail view for a single dictionary entry: headword, romanization,
// IPA, part of speech, every sense (Bangla plus English), examples,
// synonyms/antonyms, and the favorite, copy, and pronounce actions.
export default function WordDetail({
  entry,
  isFavorite,
  onToggleFavorite,
}: WordDetailProps): ReactElement {
  const speechSupported = useSpeechSupported();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const lines: string[] = [entry.headword];
    if (entry.headwordRoman) {
      lines.push(`(${entry.headwordRoman})`);
    }
    entry.senses.forEach((sense, index) => {
      const en = sense.definitionEn ? ` — ${sense.definitionEn}` : '';
      lines.push(`${index + 1}. ${sense.definitionBn}${en}`);
    });
    const text = lines.join('\n');
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable in some contexts; fail silently.
    }
  }, [entry]);

  return (
    <article className="detail" aria-label={`Details for ${entry.headword}`}>
      <header className="detail__head">
        <div>
          <h2 className="detail__headword" lang="bn">
            {entry.headword}
          </h2>
          <div className="detail__meta">
            {entry.headwordRoman && (
              <span className="detail__roman">{entry.headwordRoman}</span>
            )}
            {entry.pronunciationIPA && (
              <span className="detail__ipa">/{entry.pronunciationIPA}/</span>
            )}
            {entry.partOfSpeech && (
              <span className="badge detail__pos">{entry.partOfSpeech}</span>
            )}
          </div>
        </div>
        <div className="detail__actions">
          <button
            type="button"
            className={`icon-btn${isFavorite ? ' icon-btn--active' : ''}`}
            aria-pressed={isFavorite}
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            onClick={() => onToggleFavorite(entry.id)}
          >
            {isFavorite ? '★' : '☆'}
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="Copy definition"
            title="Copy definition"
            onClick={() => void handleCopy()}
          >
            {copied ? '✓' : '⧉'}
          </button>
          {speechSupported && (
            <button
              type="button"
              className="icon-btn"
              aria-label="Pronounce headword"
              title="Pronounce"
              onClick={() => speak(entry.headword, 'bn-BD')}
            >
              🔊
            </button>
          )}
        </div>
      </header>

      <section className="detail__senses">
        <h3 className="detail__section-title">Meanings</h3>
        <ol className="senses">
          {entry.senses.map((sense, index) => (
            <li key={index} className="sense">
              <p className="sense__bn" lang="bn">
                {sense.definitionBn}
              </p>
              {sense.definitionEn && (
                <p className="sense__en">
                  {sense.definitionEn}
                  {speechSupported && (
                    <button
                      type="button"
                      className="link-btn"
                      aria-label="Pronounce English gloss"
                      onClick={() => speak(sense.definitionEn as string, 'en-US')}
                    >
                      🔊
                    </button>
                  )}
                </p>
              )}
            </li>
          ))}
        </ol>
      </section>

      {entry.examples && entry.examples.length > 0 && (
        <section className="detail__examples">
          <h3 className="detail__section-title">Examples</h3>
          <ul className="examples">
            {entry.examples.map((example, index) => (
              <li key={index} className="example">
                <span className="example__bn" lang="bn">
                  {example.bn}
                </span>
                {example.en && <span className="example__en">{example.en}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {((entry.synonyms && entry.synonyms.length > 0) ||
        (entry.antonyms && entry.antonyms.length > 0)) && (
        <section className="detail__relations">
          {entry.synonyms && entry.synonyms.length > 0 && (
            <div className="relation">
              <h3 className="detail__section-title">Synonyms</h3>
              <div className="chips">
                {entry.synonyms.map((word) => (
                  <span key={word} className="chip" lang="bn">
                    {word}
                  </span>
                ))}
              </div>
            </div>
          )}
          {entry.antonyms && entry.antonyms.length > 0 && (
            <div className="relation">
              <h3 className="detail__section-title">Antonyms</h3>
              <div className="chips">
                {entry.antonyms.map((word) => (
                  <span key={word} className="chip" lang="bn">
                    {word}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </article>
  );
}

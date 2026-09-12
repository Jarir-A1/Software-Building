import {
  forwardRef,
  useEffect,
  useState,
  type KeyboardEvent,
  type ReactElement,
} from 'react';
import type { DictionaryEntry } from '../../shared/api';
import { transliterate } from '../../shared/phonetic';
import { useDebounced } from '../hooks';

interface SearchBarProps {
  value: string;
  phoneticInput: boolean;
  onChange: (value: string) => void;
  onSubmit: (query: string) => void;
  onSelectEntry: (entry: DictionaryEntry) => void;
}

// Returns true when the string contains a Bangla codepoint.
function containsBangla(value: string): boolean {
  return /[\u0980-\u09FF]/.test(value);
}

// The top search bar. Debounces input, fetches autocomplete suggestions from
// the engine, supports arrow-key navigation and Enter selection, shows a
// Bangla phonetic candidate for Latin input, and closes on Escape.
const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(function SearchBar(
  { value, phoneticInput, onChange, onSubmit, onSelectEntry },
  ref,
): ReactElement {
  const [suggestions, setSuggestions] = useState<DictionaryEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounced = useDebounced(value, 200);

  useEffect(() => {
    const trimmed = debounced.trim();
    if (trimmed.length === 0) {
      setSuggestions([]);
      setActiveIndex(-1);
      return;
    }
    let cancelled = false;
    void window.wordsetu.suggest(trimmed, 8).then((items) => {
      if (!cancelled) {
        setSuggestions(items);
        setActiveIndex(-1);
        setOpen(items.length > 0);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const phoneticCandidate =
    phoneticInput && value.trim().length > 0 && !containsBangla(value)
      ? transliterate(value.trim())
      : '';

  const commitSelection = (entry: DictionaryEntry): void => {
    setOpen(false);
    setActiveIndex(-1);
    onSelectEntry(entry);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'ArrowDown' && suggestions.length > 0) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((prev) => (prev + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp' && suggestions.length > 0) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (open && activeIndex >= 0 && suggestions[activeIndex]) {
        commitSelection(suggestions[activeIndex]);
      } else {
        setOpen(false);
        onSubmit(value);
      }
    } else if (event.key === 'Escape') {
      if (open) {
        event.preventDefault();
        setOpen(false);
        setActiveIndex(-1);
      } else if (value.length > 0) {
        onChange('');
      }
    }
  };

  return (
    <div className="searchbar">
      <div className="searchbar__field">
        <span className="searchbar__icon" aria-hidden="true">
          🔍
        </span>
        <input
          ref={ref}
          type="search"
          className="searchbar__input"
          placeholder="Search in Bangla or type in English (e.g. ami, boi)"
          aria-label="Search the dictionary"
          role="combobox"
          aria-expanded={open}
          aria-controls="search-suggestions"
          autoComplete="off"
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
        />
      </div>

      {phoneticCandidate && (
        <div className="searchbar__phonetic" aria-live="polite">
          Bangla: <strong lang="bn">{phoneticCandidate}</strong>
        </div>
      )}

      {open && suggestions.length > 0 && (
        <ul className="suggestions" id="search-suggestions" role="listbox">
          {suggestions.map((entry, index) => (
            <li
              key={entry.id}
              role="option"
              aria-selected={index === activeIndex}
              className={`suggestion${index === activeIndex ? ' suggestion--active' : ''}`}
              onMouseDown={(event) => {
                // mousedown so it fires before the input blur closes the list.
                event.preventDefault();
                commitSelection(entry);
              }}
            >
              <span className="suggestion__head" lang="bn">
                {entry.headword}
              </span>
              {entry.senses[0]?.definitionEn && (
                <span className="suggestion__gloss">{entry.senses[0].definitionEn}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});

export default SearchBar;

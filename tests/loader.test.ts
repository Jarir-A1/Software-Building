import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DictionaryValidationError,
  ENGLISH_STOP_WORDS,
  indexableEnglishTokens,
  loadDictionary,
  normalizeBangla,
  normalizeEnglish,
  tokenizeEnglish,
} from '../src/main/dictionary/loader';
import type { DictionaryFile } from '../src/main/dictionary/types';

const here = dirname(fileURLToPath(import.meta.url));
const dataPath = join(here, '..', 'resources', 'dictionary', 'entries.json');
const malformedPath = join(here, 'fixtures', 'malformed.json');

function loadSeedFile(): DictionaryFile {
  return JSON.parse(readFileSync(dataPath, 'utf8')) as DictionaryFile;
}

describe('loadDictionary with real seed data', () => {
  it('loads the expanded corpus of at least 350 valid entries and builds indexes', () => {
    const file = loadSeedFile();
    // The 0.2.0 expansion roughly doubled the corpus.
    expect(file.entries.length).toBeGreaterThanOrEqual(350);

    const indexes = loadDictionary(file);
    expect(indexes.entries.length).toBe(file.entries.length);
    // byId covers every entry.
    expect(indexes.byId.size).toBe(file.entries.length);
    // sortedHeadwords is sorted and non empty.
    expect(indexes.sortedHeadwords.length).toBeGreaterThan(0);
    const sortedCopy = indexes.sortedHeadwords.slice().sort((a, b) => a.localeCompare(b, 'bn'));
    expect(indexes.sortedHeadwords).toEqual(sortedCopy);
    // English reverse index has entries for common glosses.
    expect(indexes.englishIndex.get('water')?.length ?? 0).toBeGreaterThan(0);
  });

  it('resolves a known headword and getById to the same entry', () => {
    const indexes = loadDictionary(loadSeedFile());
    const ids = indexes.byHeadword.get(normalizeBangla('বই'));
    expect(ids).toBeDefined();
    const id = ids![0];
    const entry = indexes.byId.get(id);
    expect(entry?.headword).toBe('বই');
    expect(entry?.senses[0].definitionEn).toBe('book');
  });

  it('stores Bangla headwords in NFC normalized form', () => {
    const indexes = loadDictionary(loadSeedFile());
    for (const headword of indexes.sortedHeadwords) {
      expect(headword).toBe(headword.normalize('NFC'));
    }
  });
});

describe('loadDictionary validation', () => {
  it('rejects a malformed dictionary and reports every problem', () => {
    const raw = readFileSync(malformedPath, 'utf8');
    let error: unknown;
    try {
      loadDictionary(raw);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(DictionaryValidationError);
    const validationError = error as DictionaryValidationError;
    // One entry has empty senses, another is missing an id: two problems.
    expect(validationError.problems.length).toBeGreaterThanOrEqual(2);
    expect(validationError.problems.join(' ')).toContain('sense');
  });

  it('throws when the entries array is missing', () => {
    expect(() => loadDictionary('{"version":1,"language":"bn-en"}')).toThrow(
      DictionaryValidationError,
    );
  });

  it('throws on invalid JSON', () => {
    expect(() => loadDictionary('{ not json ')).toThrow(DictionaryValidationError);
  });

  it('detects duplicate ids', () => {
    const dup: DictionaryFile = {
      version: 1,
      language: 'bn-en',
      entries: [
        { id: 'x', headword: 'ক', senses: [{ definitionBn: 'একটি' }] },
        { id: 'x', headword: 'খ', senses: [{ definitionBn: 'দুটি' }] },
      ],
    };
    expect(() => loadDictionary(dup)).toThrow(/duplicate id/);
  });
});

describe('normalization helpers', () => {
  it('case folds English', () => {
    expect(normalizeEnglish('  WATER ')).toBe('water');
  });

  it('tokenizes English glosses into lowercase word tokens', () => {
    expect(tokenizeEnglish('Book, story-teller')).toEqual(['book', 'story', 'teller']);
  });
});

describe('English stop-word filtering for the reverse index', () => {
  it('drops common stop words from the indexable tokens but keeps content words', () => {
    // "to go" indexes only "go"; "on the water" indexes only "water".
    expect(indexableEnglishTokens('to go')).toEqual(['go']);
    expect(indexableEnglishTokens('on the water')).toEqual(['water']);
  });

  it('falls back to the full token list when a gloss is only stop words', () => {
    // A gloss made entirely of function words must not vanish from the index,
    // so the entry stays reachable and the whole-gloss exact match still works.
    expect(indexableEnglishTokens('to the')).toEqual(['to', 'the']);
  });

  it('does not index the stop word "to" from real seed glosses', () => {
    const indexes = loadDictionary(loadSeedFile());
    // The seed has many glosses containing "to" (e.g. "to go", "to come"), but
    // "to" is a stop word and so must not appear in the English reverse index.
    expect(indexes.englishIndex.has('to')).toBe(false);
    // The content word from those glosses is still indexed.
    expect(indexes.englishIndex.get('go')?.length ?? 0).toBeGreaterThan(0);
  });

  it('exposes a non-empty stop-word set covering common function words', () => {
    expect(ENGLISH_STOP_WORDS.has('to')).toBe(true);
    expect(ENGLISH_STOP_WORDS.has('the')).toBe(true);
    // A content word is not a stop word.
    expect(ENGLISH_STOP_WORDS.has('water')).toBe(false);
  });
});

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadDictionary } from '../src/main/dictionary/loader';
import { DictionaryEngine, createEngine, detectScript } from '../src/main/dictionary/engine';
import type { DictionaryFile } from '../src/main/dictionary/types';

const here = dirname(fileURLToPath(import.meta.url));
const dataPath = join(here, '..', 'resources', 'dictionary', 'entries.json');

let engine: DictionaryEngine;

beforeAll(() => {
  const file = JSON.parse(readFileSync(dataPath, 'utf8')) as DictionaryFile;
  engine = createEngine(loadDictionary(file));
});

describe('script detection', () => {
  it('detects Bangla and Latin scripts', () => {
    expect(detectScript('বই')).toBe('bangla');
    expect(detectScript('boi')).toBe('latin');
    expect(detectScript('boi বই')).toBe('bangla');
  });
});

describe('DictionaryEngine.getById', () => {
  it('returns the exact entry for a known id and undefined otherwise', () => {
    expect(engine.getById('boi')?.headword).toBe('বই');
    expect(engine.getById('does-not-exist')).toBeUndefined();
  });
});

describe('DictionaryEngine.search exact and transliteration', () => {
  it('returns an exact Bangla headword first', () => {
    const results = engine.search('বই');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].entry.headword).toBe('বই');
    expect(results[0].matchType).toBe('exact');
  });

  it('transliterates Latin input and finds the Bangla entry (ami -> আমি)', () => {
    const results = engine.search('ami');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].entry.headword).toBe('আমি');
    expect(results[0].matchType).toBe('transliterated-exact');
  });

  it('does not transliterate when the option is disabled', () => {
    const results = engine.search('ami', { transliterate: false });
    // Without transliteration and no English gloss for "ami", there is no
    // transliterated-exact hit for আমি.
    expect(results.find((r) => r.matchType === 'transliterated-exact')).toBeUndefined();
  });
});

describe('DictionaryEngine.search fuzzy tolerance', () => {
  it('tolerates a one character typo and returns the intended word', () => {
    // 'শহব' is a single substitution typo of 'শহর' (city).
    const results = engine.search('শহব');
    const headwords = results.map((r) => r.entry.headword);
    expect(headwords).toContain('শহর');
  });

  it('finds the target under a one character typo of a longer word', () => {
    // 'পাখা' would be far; use 'পাখ1' style single substitution of 'পাখি'.
    const results = engine.search('পাখী');
    expect(results.map((r) => r.entry.headword)).toContain('পাখি');
  });

  it('skips fuzzy matches when fuzzy is disabled', () => {
    const results = engine.search('শহব', { fuzzy: false });
    expect(results.find((r) => r.matchType === 'fuzzy')).toBeUndefined();
  });
});

describe('DictionaryEngine.search cross language', () => {
  it('En -> Bn: an English gloss returns the corresponding Bangla entry', () => {
    const results = engine.search('book');
    expect(results[0].entry.headword).toBe('বই');
    expect(results[0].matchType).toBe('cross-language');
  });

  it('En -> Bn: "water" returns the water entries', () => {
    const results = engine.search('water');
    const headwords = results.map((r) => r.entry.headword);
    expect(headwords).toContain('জল');
    expect(headwords).toContain('পানি');
  });

  it('Bn -> En: the matched Bangla entry carries the English definition', () => {
    const results = engine.search('জল');
    expect(results[0].entry.headword).toBe('জল');
    expect(results[0].entry.senses[0].definitionEn).toBe('water');
  });
});

describe('DictionaryEngine.search ranking order', () => {
  it('ranks exact above prefix above fuzzy', () => {
    // 'ভাল' is a prefix of 'ভালো' and near several other words.
    const results = engine.search('ভাল');
    const exactOrPrefixIndex = results.findIndex((r) => r.entry.headword === 'ভালো');
    const anyFuzzyIndex = results.findIndex((r) => r.matchType === 'fuzzy');
    expect(exactOrPrefixIndex).toBeGreaterThanOrEqual(0);
    if (anyFuzzyIndex >= 0) {
      expect(exactOrPrefixIndex).toBeLessThan(anyFuzzyIndex);
    }
    // Scores are non increasing (stable descending ranking).
    for (let i = 1; i < results.length; i += 1) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it('respects the limit option', () => {
    const results = engine.search('ব', { limit: 3 });
    expect(results.length).toBeLessThanOrEqual(3);
  });
});

describe('DictionaryEngine.suggest', () => {
  it('returns headwords that start with the Bangla prefix', () => {
    const suggestions = engine.suggest('বা', 5);
    expect(suggestions.length).toBeGreaterThan(0);
    for (const entry of suggestions) {
      expect(entry.headword.startsWith('বা')).toBe(true);
    }
  });

  it('transliterates a Latin prefix before suggesting', () => {
    const suggestions = engine.suggest('ba', 5);
    expect(suggestions.map((e) => e.headword)).toContain('বাংলা');
  });

  it('returns an empty list for an empty prefix', () => {
    expect(engine.suggest('   ', 5)).toEqual([]);
  });
});

describe('DictionaryEngine.wordOfTheDay', () => {
  it('is deterministic for the same date', () => {
    const a = engine.wordOfTheDay('2024-01-01');
    const b = engine.wordOfTheDay('2024-01-01');
    expect(a?.id).toBe(b?.id);
  });

  it('generally differs across dates', () => {
    const a = engine.wordOfTheDay('2024-01-01');
    const b = engine.wordOfTheDay('2024-06-15');
    expect(a?.id).not.toBe(b?.id);
  });

  it('accepts a Date object and returns an entry', () => {
    const entry = engine.wordOfTheDay(new Date('2024-03-21T00:00:00Z'));
    expect(entry).toBeDefined();
    expect(engine.getById(entry!.id)).toBeDefined();
  });
});

describe('DictionaryEngine.random', () => {
  it('returns an entry that exists in the dictionary', () => {
    const entry = engine.random(42);
    expect(entry).toBeDefined();
    expect(engine.getById(entry!.id)).toBeDefined();
  });

  it('is deterministic for a fixed seed', () => {
    expect(engine.random(7)?.id).toBe(engine.random(7)?.id);
  });
});

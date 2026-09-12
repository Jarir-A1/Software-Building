// Dictionary loader and indexer.
//
// Parses the bundled dictionary JSON, validates every entry against the schema,
// and builds the in memory indexes that the search engine relies on. All of
// this is pure logic with no Electron or filesystem coupling: callers pass the
// already parsed data (or a JSON string) so the loader can be unit tested in a
// plain Node environment.

import type { DictionaryEntry, DictionaryFile } from './types';

// The set of indexes produced from a validated dictionary file. The engine is
// constructed directly from this structure.
export interface DictionaryIndexes {
  // The validated, normalized entries in file order.
  entries: DictionaryEntry[];
  // Entry id -> entry.
  byId: Map<string, DictionaryEntry>;
  // Normalized (NFC) Bangla headword -> entry ids. A headword can, in theory,
  // map to more than one entry, so the value is an array.
  byHeadword: Map<string, string[]>;
  // Sorted array of normalized headwords for binary style prefix search.
  sortedHeadwords: string[];
  // Normalized headword -> entry ids, kept in lockstep with sortedHeadwords.
  headwordToIds: Map<string, string[]>;
  // Normalized English token -> entry ids that mention it (reverse index).
  englishIndex: Map<string, string[]>;
  // Normalized Bangla token -> entry ids, for substring / token search.
  banglaTokenIndex: Map<string, string[]>;
}

// Error raised when the dictionary data fails validation. Carries the list of
// individual problems found so callers can surface actionable messages.
export class DictionaryValidationError extends Error {
  public readonly problems: string[];

  constructor(problems: string[]) {
    super(
      `Dictionary validation failed with ${problems.length} problem(s): ${problems.join('; ')}`,
    );
    this.name = 'DictionaryValidationError';
    this.problems = problems;
  }
}

// Normalizes Bangla text to Unicode NFC. Composed forms make headword and token
// comparisons reliable regardless of how the source text was encoded.
export function normalizeBangla(value: string): string {
  return value.normalize('NFC').trim();
}

// Case folds and normalizes English text so lookups are case insensitive and
// whitespace tolerant.
export function normalizeEnglish(value: string): string {
  return value.normalize('NFC').trim().toLowerCase();
}

// Splits an English string into lowercase word tokens (letters and digits).
export function tokenizeEnglish(value: string): string[] {
  const normalized = normalizeEnglish(value);
  const matches = normalized.match(/[a-z0-9]+/g);
  return matches ?? [];
}

// Splits a Bangla string into word tokens on whitespace and common
// punctuation, normalizing each token to NFC.
export function tokenizeBangla(value: string): string[] {
  return normalizeBangla(value)
    .split(/[\s,।;:!?()"'“”]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

// Validates a single raw entry, pushing human readable problems into the given
// list. Returns a normalized DictionaryEntry when valid, otherwise null.
function validateEntry(raw: unknown, index: number, problems: string[]): DictionaryEntry | null {
  const where = `entry[${index}]`;
  if (typeof raw !== 'object' || raw === null) {
    problems.push(`${where} is not an object`);
    return null;
  }
  const record = raw as Record<string, unknown>;

  if (typeof record.id !== 'string' || record.id.trim().length === 0) {
    problems.push(`${where} is missing a non-empty string id`);
    return null;
  }
  const id = record.id.trim();

  if (typeof record.headword !== 'string' || record.headword.trim().length === 0) {
    problems.push(`${where} (${id}) is missing a non-empty headword`);
    return null;
  }

  if (!Array.isArray(record.senses) || record.senses.length === 0) {
    problems.push(`${where} (${id}) must have at least one sense`);
    return null;
  }

  const senses = [] as DictionaryEntry['senses'];
  for (let s = 0; s < record.senses.length; s += 1) {
    const sense = record.senses[s] as Record<string, unknown>;
    if (typeof sense !== 'object' || sense === null) {
      problems.push(`${where} (${id}) sense[${s}] is not an object`);
      return null;
    }
    if (typeof sense.definitionBn !== 'string' || sense.definitionBn.trim().length === 0) {
      problems.push(`${where} (${id}) sense[${s}] is missing definitionBn`);
      return null;
    }
    senses.push({
      definitionBn: normalizeBangla(sense.definitionBn),
      definitionEn: typeof sense.definitionEn === 'string' ? sense.definitionEn.trim() : undefined,
    });
  }

  const entry: DictionaryEntry = {
    id,
    headword: normalizeBangla(record.headword),
    headwordRoman:
      typeof record.headwordRoman === 'string' ? record.headwordRoman.trim() : undefined,
    partOfSpeech: typeof record.partOfSpeech === 'string' ? record.partOfSpeech.trim() : undefined,
    pronunciationIPA:
      typeof record.pronunciationIPA === 'string' ? record.pronunciationIPA.trim() : undefined,
    senses,
    synonyms: Array.isArray(record.synonyms)
      ? record.synonyms.filter((v): v is string => typeof v === 'string').map(normalizeBangla)
      : undefined,
    antonyms: Array.isArray(record.antonyms)
      ? record.antonyms.filter((v): v is string => typeof v === 'string').map(normalizeBangla)
      : undefined,
    examples: Array.isArray(record.examples)
      ? record.examples
          .filter((v): v is Record<string, unknown> => typeof v === 'object' && v !== null)
          .filter((v) => typeof v.bn === 'string')
          .map((v) => ({
            bn: normalizeBangla(v.bn as string),
            en: typeof v.en === 'string' ? (v.en as string).trim() : undefined,
          }))
      : undefined,
    tags: Array.isArray(record.tags)
      ? record.tags.filter((v): v is string => typeof v === 'string')
      : undefined,
  };

  return entry;
}

// Adds an id to a Map<string, string[]> under key, creating the bucket and
// de-duplicating as needed.
function pushToIndex(index: Map<string, string[]>, key: string, id: string): void {
  if (key.length === 0) {
    return;
  }
  const bucket = index.get(key);
  if (bucket) {
    if (!bucket.includes(id)) {
      bucket.push(id);
    }
  } else {
    index.set(key, [id]);
  }
}

// Loads and validates a dictionary from either a parsed DictionaryFile object
// or a raw JSON string, then builds all search indexes. Throws
// DictionaryValidationError when any entry is malformed.
export function loadDictionary(source: string | DictionaryFile): DictionaryIndexes {
  let file: DictionaryFile;
  if (typeof source === 'string') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(source);
    } catch (error) {
      throw new DictionaryValidationError([
        `source is not valid JSON: ${(error as Error).message}`,
      ]);
    }
    file = parsed as DictionaryFile;
  } else {
    file = source;
  }

  const problems: string[] = [];

  if (typeof file !== 'object' || file === null || !Array.isArray(file.entries)) {
    throw new DictionaryValidationError(['dictionary file is missing an entries array']);
  }

  const entries: DictionaryEntry[] = [];
  const byId = new Map<string, DictionaryEntry>();
  const byHeadword = new Map<string, string[]>();
  const englishIndex = new Map<string, string[]>();
  const banglaTokenIndex = new Map<string, string[]>();

  for (let i = 0; i < file.entries.length; i += 1) {
    const entry = validateEntry(file.entries[i], i, problems);
    if (!entry) {
      continue;
    }
    if (byId.has(entry.id)) {
      problems.push(`entry[${i}] has duplicate id "${entry.id}"`);
      continue;
    }

    entries.push(entry);
    byId.set(entry.id, entry);

    const normalizedHeadword = normalizeBangla(entry.headword);
    pushToIndex(byHeadword, normalizedHeadword, entry.id);

    // Index the headword tokens and synonyms for Bangla substring / token search.
    for (const token of tokenizeBangla(entry.headword)) {
      pushToIndex(banglaTokenIndex, token, entry.id);
    }
    for (const synonym of entry.synonyms ?? []) {
      for (const token of tokenizeBangla(synonym)) {
        pushToIndex(banglaTokenIndex, token, entry.id);
      }
    }

    // Build the English reverse index from glosses and English definitions.
    for (const sense of entry.senses) {
      if (sense.definitionEn) {
        for (const token of tokenizeEnglish(sense.definitionEn)) {
          pushToIndex(englishIndex, token, entry.id);
        }
      }
    }
  }

  if (problems.length > 0) {
    throw new DictionaryValidationError(problems);
  }

  const headwordToIds = byHeadword;
  const sortedHeadwords = Array.from(byHeadword.keys()).sort((a, b) => a.localeCompare(b, 'bn'));

  return {
    entries,
    byId,
    byHeadword,
    sortedHeadwords,
    headwordToIds,
    englishIndex,
    banglaTokenIndex,
  };
}

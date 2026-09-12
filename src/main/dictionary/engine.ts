// The WordSetu search engine.
//
// Built on top of the indexes produced by the loader, the engine exposes:
//   - search(query, options): ranked, multi strategy search with script auto
//     detection, optional Latin to Bangla transliteration, and cross language
//     (En <-> Bn) results.
//   - suggest(prefix, limit): autocomplete suggestions.
//   - getById(id): direct entry lookup.
//   - wordOfTheDay(seedDate): deterministic pick keyed by calendar date.
//   - random(): a pseudo random entry.
//
// Pure and framework agnostic: it depends only on the loader, phonetic, and
// fuzzy modules, all of which are themselves free of runtime coupling.

import { boundedLevenshtein } from './fuzzy';
import type { DictionaryIndexes } from './loader';
import { normalizeBangla, normalizeEnglish, tokenizeEnglish } from './loader';
import { transliterate } from '../../shared/phonetic';
import type { DictionaryEntry, MatchType, SearchOptions, SearchResult } from './types';

// Base scores per match type. Higher is better. Exact wins over headword
// prefix which wins over cross language which wins over fuzzy, giving a stable
// ranking.
const MATCH_SCORES: Record<MatchType, number> = {
  exact: 1000,
  'transliterated-exact': 950,
  'headword-prefix': 800,
  'cross-language': 500,
  substring: 400,
  fuzzy: 200,
};

const DEFAULT_LIMIT = 25;
const DEFAULT_FUZZY_THRESHOLD = 2;

// Returns true when the string contains at least one Bangla codepoint.
export function containsBangla(value: string): boolean {
  return /[\u0980-\u09FF]/.test(value);
}

// Detects the dominant script of a query.
export function detectScript(value: string): 'bangla' | 'latin' {
  return containsBangla(value) ? 'bangla' : 'latin';
}

export class DictionaryEngine {
  private readonly indexes: DictionaryIndexes;

  constructor(indexes: DictionaryIndexes) {
    this.indexes = indexes;
  }

  // Total number of entries loaded.
  public get size(): number {
    return this.indexes.entries.length;
  }

  // Direct lookup by stable id. Returns undefined when not found.
  public getById(id: string): DictionaryEntry | undefined {
    return this.indexes.byId.get(id);
  }

  // Returns all entries in file order (defensive copy).
  public all(): DictionaryEntry[] {
    return this.indexes.entries.slice();
  }

  // Autocomplete: returns headwords that start with the given prefix. Latin
  // input is transliterated to Bangla first so users can type with a Latin
  // keyboard. Results are sorted, capped at limit.
  public suggest(prefix: string, limit = 10): DictionaryEntry[] {
    const trimmed = prefix.trim();
    if (trimmed.length === 0) {
      return [];
    }
    const query =
      detectScript(trimmed) === 'latin'
        ? normalizeBangla(transliterate(trimmed))
        : normalizeBangla(trimmed);

    const matches: DictionaryEntry[] = [];
    for (const headword of this.indexes.sortedHeadwords) {
      if (headword.startsWith(query)) {
        const ids = this.indexes.headwordToIds.get(headword) ?? [];
        for (const id of ids) {
          const entry = this.indexes.byId.get(id);
          if (entry) {
            matches.push(entry);
          }
        }
      }
      if (matches.length >= limit) {
        break;
      }
    }
    return matches.slice(0, limit);
  }

  // The primary search entry point. Combines exact, prefix, substring, fuzzy,
  // and cross language strategies, then ranks and de-duplicates results.
  public search(query: string, options: SearchOptions = {}): SearchResult[] {
    const limit = options.limit ?? DEFAULT_LIMIT;
    const fuzzyEnabled = options.fuzzy ?? true;
    const fuzzyThreshold = options.fuzzyThreshold ?? DEFAULT_FUZZY_THRESHOLD;
    const allowTransliteration = options.transliterate ?? true;

    const trimmed = query.trim();
    if (trimmed.length === 0) {
      return [];
    }

    const script = detectScript(trimmed);
    // best score seen per entry id, so an entry only appears once at its best rank.
    const best = new Map<string, SearchResult>();

    const consider = (entry: DictionaryEntry, matchType: MatchType, bonus = 0): void => {
      const score = MATCH_SCORES[matchType] + bonus;
      const existing = best.get(entry.id);
      if (!existing || score > existing.score) {
        best.set(entry.id, { entry, matchType, score });
      }
    };

    if (script === 'bangla') {
      this.searchBangla(normalizeBangla(trimmed), fuzzyEnabled, fuzzyThreshold, consider);
    } else {
      // Latin input: try cross language (English) lookup and, when enabled,
      // transliterate to Bangla and run the Bangla search too.
      this.searchEnglish(trimmed, consider);
      if (allowTransliteration) {
        const bangla = normalizeBangla(transliterate(trimmed));
        if (bangla.length > 0) {
          this.searchBangla(bangla, fuzzyEnabled, fuzzyThreshold, consider, true);
        }
      }
    }

    const results = Array.from(best.values());
    results.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      // Stable tie break by headword then id for deterministic ordering.
      const headwordCompare = a.entry.headword.localeCompare(b.entry.headword, 'bn');
      if (headwordCompare !== 0) {
        return headwordCompare;
      }
      return a.entry.id.localeCompare(b.entry.id);
    });
    return results.slice(0, limit);
  }

  // Bangla side search: exact headword, prefix, substring token, and fuzzy.
  private searchBangla(
    query: string,
    fuzzyEnabled: boolean,
    fuzzyThreshold: number,
    consider: (entry: DictionaryEntry, matchType: MatchType, bonus?: number) => void,
    fromTransliteration = false,
  ): void {
    // Exact headword match.
    const exactIds = this.indexes.byHeadword.get(query);
    if (exactIds) {
      for (const id of exactIds) {
        const entry = this.indexes.byId.get(id);
        if (entry) {
          consider(entry, fromTransliteration ? 'transliterated-exact' : 'exact');
        }
      }
    }

    // Prefix and substring matches over headwords.
    for (const headword of this.indexes.sortedHeadwords) {
      if (headword === query) {
        continue;
      }
      const ids = this.indexes.headwordToIds.get(headword) ?? [];
      if (headword.startsWith(query)) {
        // Shorter headwords rank slightly higher within the prefix band.
        const bonus = Math.max(0, 50 - (headword.length - query.length));
        for (const id of ids) {
          const entry = this.indexes.byId.get(id);
          if (entry) {
            consider(entry, 'headword-prefix', bonus);
          }
        }
      } else if (headword.includes(query)) {
        for (const id of ids) {
          const entry = this.indexes.byId.get(id);
          if (entry) {
            consider(entry, 'substring');
          }
        }
      }
    }

    // Token / synonym substring index.
    const tokenIds = this.indexes.banglaTokenIndex.get(query);
    if (tokenIds) {
      for (const id of tokenIds) {
        const entry = this.indexes.byId.get(id);
        if (entry) {
          consider(entry, 'substring');
        }
      }
    }

    // Fuzzy match over headwords using bounded edit distance.
    if (fuzzyEnabled) {
      for (const headword of this.indexes.sortedHeadwords) {
        const distance = boundedLevenshtein(query, headword, fuzzyThreshold);
        if (distance <= fuzzyThreshold && distance > 0) {
          // Closer matches score higher within the fuzzy band.
          const bonus = (fuzzyThreshold - distance + 1) * 20;
          const ids = this.indexes.headwordToIds.get(headword) ?? [];
          for (const id of ids) {
            const entry = this.indexes.byId.get(id);
            if (entry) {
              consider(entry, 'fuzzy', bonus);
            }
          }
        }
      }
    }
  }

  // English side search: look up entries by their English gloss tokens.
  private searchEnglish(
    query: string,
    consider: (entry: DictionaryEntry, matchType: MatchType, bonus?: number) => void,
  ): void {
    const tokens = tokenizeEnglish(query);
    if (tokens.length === 0) {
      return;
    }

    // An entry that matches every query token is a stronger cross language hit.
    const matchCounts = new Map<string, number>();
    for (const token of tokens) {
      const ids = this.indexes.englishIndex.get(token);
      if (!ids) {
        continue;
      }
      for (const id of ids) {
        matchCounts.set(id, (matchCounts.get(id) ?? 0) + 1);
      }
    }

    const fullQuery = normalizeEnglish(query);
    for (const [id, count] of matchCounts) {
      const entry = this.indexes.byId.get(id);
      if (!entry) {
        continue;
      }
      let bonus = count * 20;
      // Extra weight when a gloss equals the whole query (a clean definition hit).
      const isExactGloss = entry.senses.some(
        (sense) => sense.definitionEn && normalizeEnglish(sense.definitionEn) === fullQuery,
      );
      if (isExactGloss) {
        bonus += 200;
      }
      consider(entry, 'cross-language', bonus);
    }
  }

  // Deterministic word of the day: the same seedDate always yields the same
  // entry, and different dates generally yield different entries. seedDate may
  // be a Date or an ISO date string (YYYY-MM-DD).
  public wordOfTheDay(seedDate: Date | string = new Date()): DictionaryEntry | undefined {
    if (this.indexes.entries.length === 0) {
      return undefined;
    }
    const key = typeof seedDate === 'string' ? seedDate : this.toDateKey(seedDate);
    const hash = this.hashString(key);
    const index = hash % this.indexes.entries.length;
    return this.indexes.entries[index];
  }

  // Returns a pseudo random entry. Accepts an optional seed for testability.
  public random(seed?: number): DictionaryEntry | undefined {
    if (this.indexes.entries.length === 0) {
      return undefined;
    }
    const basis = seed ?? Math.floor(Math.random() * 1_000_000);
    const index = Math.abs(basis) % this.indexes.entries.length;
    return this.indexes.entries[index];
  }

  // Converts a Date to a YYYY-MM-DD key using UTC to avoid timezone drift.
  private toDateKey(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // A small, stable string hash (FNV-1a style) returning a non negative int.
  private hashString(value: string): number {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }
}

// Convenience factory that mirrors the class constructor.
export function createEngine(indexes: DictionaryIndexes): DictionaryEngine {
  return new DictionaryEngine(indexes);
}

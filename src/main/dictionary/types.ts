// Core data model for the WordSetu offline Bangla dictionary.
//
// These types are pure and framework agnostic. They must never import from
// Electron, React, or any runtime specific module so that the dictionary
// engine can be unit tested in a plain Node environment.

// A single sense (meaning) of a headword. A headword may carry several senses,
// each with a Bangla definition and an optional English definition.
export interface Sense {
  // The definition written in Bangla. Required for every sense.
  definitionBn: string;
  // Optional English definition or gloss for the same sense.
  definitionEn?: string;
}

// A usage example for a headword, given in Bangla with an optional English
// translation.
export interface Example {
  bn: string;
  en?: string;
}

// A dictionary entry keyed by a stable id. The headword is the Bangla word.
export interface DictionaryEntry {
  // Stable unique identifier for the entry (ASCII slug, never localized).
  id: string;
  // The Bangla headword, stored as valid UTF-8 and normalized to NFC on load.
  headword: string;
  // Optional romanization (Latin transliteration) of the headword.
  headwordRoman?: string;
  // Optional part of speech tag (for example noun, verb, adjective).
  partOfSpeech?: string;
  // Optional IPA pronunciation string.
  pronunciationIPA?: string;
  // One or more senses. At least one sense is required by the validator.
  senses: Sense[];
  // Optional list of Bangla synonyms.
  synonyms?: string[];
  // Optional list of Bangla antonyms.
  antonyms?: string[];
  // Optional usage examples.
  examples?: Example[];
  // Optional free form tags (for example common, formal, colloquial).
  tags?: string[];
}

// The on disk shape of the bundled dictionary data file.
export interface DictionaryFile {
  // Schema version of the data file, so future migrations are possible.
  version: number;
  // The dictionary language pair identifier, for example "bn-en".
  language: string;
  // The full list of entries.
  entries: DictionaryEntry[];
}

// Maps a normalized English token to the ids of the Bangla entries whose
// English glosses or definitions contain that token. Used for En to Bn lookup.
export interface EnglishIndexEntry {
  token: string;
  ids: string[];
}

// The category of a match, used for ranking. Lower rank value sorts first.
export type MatchType =
  | 'exact'
  | 'headword-prefix'
  | 'transliterated-exact'
  | 'cross-language'
  | 'substring'
  | 'fuzzy';

// A single search result carrying the matched entry, why it matched, and a
// numeric score for stable ranking (higher score is a better match).
export interface SearchResult {
  entry: DictionaryEntry;
  matchType: MatchType;
  score: number;
}

// Options accepted by DictionaryEngine.search.
export interface SearchOptions {
  // Maximum number of results to return. Defaults to a sensible limit.
  limit?: number;
  // When true, Latin input is transliterated to Bangla before searching.
  // Defaults to true so users can type Bangla with a Latin keyboard.
  transliterate?: boolean;
  // Maximum edit distance allowed for fuzzy matches. Defaults to 2.
  fuzzyThreshold?: number;
  // When false, fuzzy matching is skipped entirely. Defaults to true.
  fuzzy?: boolean;
}

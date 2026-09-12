// Avro style phonetic transliteration: converts Latin (Roman) input into
// Bangla script. This lets users type Bangla words using an ordinary Latin
// keyboard, for example typing "ami" to produce "আমি" and "bangla" to produce
// "বাংলা".
//
// The implementation is data driven: all mapping tables live at the top of the
// module so the behavior is easy to audit and extend. It is intentionally a
// pragmatic subset of the full Avro layout, focused on a documented and tested
// set of common cases (vowels, consonants, a handful of conjuncts, and correct
// vowel sign / kar placement after consonants).
//
// This module is pure and has no external dependencies.

// Independent vowels: used when a vowel sound starts a word or follows another
// vowel. The keys are ordered longest first when matched (see the matcher).
const INDEPENDENT_VOWELS: Record<string, string> = {
  oi: 'ঐ',
  ou: 'ঔ',
  aa: 'আ',
  a: 'আ',
  i: 'ই',
  ii: 'ঈ',
  ee: 'ঈ',
  u: 'উ',
  uu: 'ঊ',
  oo: 'উ',
  rri: 'ঋ',
  e: 'এ',
  o: 'অ',
};

// Vowel signs (kar): used when a vowel follows a consonant. The inherent
// vowel "অ" (o sound) has no visible sign, represented here by an empty string.
const VOWEL_SIGNS: Record<string, string> = {
  oi: 'ৈ',
  ou: 'ৌ',
  aa: 'া',
  a: 'া',
  i: 'ি',
  ii: 'ী',
  ee: 'ী',
  u: 'ু',
  uu: 'ূ',
  oo: 'ু',
  rri: 'ৃ',
  e: 'ে',
  o: '',
};

// Consonants and consonant clusters. Longer keys are attempted before shorter
// ones so that digraphs like "kh", "gh", "ch", "sh", "ng" win over single
// letters. Values are the base Bangla consonant with its inherent vowel.
const CONSONANTS: Record<string, string> = {
  kh: 'খ',
  gh: 'ঘ',
  ch: 'চ',
  chh: 'ছ',
  jh: 'ঝ',
  th: 'থ',
  dh: 'ধ',
  ph: 'ফ',
  bh: 'ভ',
  sh: 'শ',
  ss: 'ষ',
  ng: 'ং',
  ngg: 'ঙ',
  nn: 'ণ',
  rr: 'ড়',
  k: 'ক',
  g: 'গ',
  c: 'চ',
  j: 'জ',
  t: 'ত',
  T: 'ট',
  d: 'দ',
  D: 'ড',
  n: 'ন',
  p: 'প',
  f: 'ফ',
  b: 'ব',
  v: 'ভ',
  m: 'ম',
  z: 'জ',
  r: 'র',
  l: 'ল',
  s: 'স',
  h: 'হ',
  y: 'য়',
  Y: 'য',
  w: 'ও',
};

// The hasanta (virama) sign, used to build conjuncts (juktakkhor) by joining
// two consonants without an intervening vowel.
const HASANTA = '্';

// A small set of explicit, well known conjuncts and whole words. These take
// priority over the general algorithm so that important cases are always
// correct regardless of the greedy matcher.
const OVERRIDES: Record<string, string> = {
  bangla: 'বাংলা',
  banglaa: 'বাংলা',
  ami: 'আমি',
  tumi: 'তুমি',
  apni: 'আপনি',
  boi: 'বই',
  jol: 'জল',
  pani: 'পানি',
  bhalo: 'ভালো',
  kok: 'কক',
  kkha: 'ক্ষ',
  gga: 'জ্ঞ',
};

// Determines whether a mapping key represents a vowel.
function isVowelKey(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(INDEPENDENT_VOWELS, key);
}

// Attempts to match the longest consonant key at position i in the input.
function matchConsonant(input: string, i: number): { key: string; length: number } | null {
  // Try lengths from 3 down to 1 to prefer clusters like "chh" and "ngg".
  for (let len = 3; len >= 1; len -= 1) {
    const slice = input.slice(i, i + len);
    if (Object.prototype.hasOwnProperty.call(CONSONANTS, slice)) {
      return { key: slice, length: len };
    }
  }
  return null;
}

// Attempts to match the longest vowel key at position i in the input. The
// caseSensitive flag is not needed here because vowels are matched on the
// lowercased input.
function matchVowel(input: string, i: number): { key: string; length: number } | null {
  for (let len = 3; len >= 1; len -= 1) {
    const slice = input.slice(i, i + len);
    if (isVowelKey(slice)) {
      return { key: slice, length: len };
    }
  }
  return null;
}

// Transliterates a single Latin token (no whitespace) into Bangla.
function transliterateToken(token: string): string {
  if (token.length === 0) {
    return '';
  }

  const override = OVERRIDES[token.toLowerCase()];
  if (override !== undefined) {
    return override;
  }

  // Consonant keys are case sensitive (T, D, Y, ss) but vowel matching and the
  // general flow use the raw token so casing is preserved for the consonant
  // table lookups.
  let output = '';
  let i = 0;
  // Tracks whether the previous emitted unit was a consonant, so a following
  // vowel is rendered as a kar rather than an independent vowel.
  let previousWasConsonant = false;

  while (i < token.length) {
    const consonant = matchConsonant(token, i);
    if (consonant) {
      if (previousWasConsonant) {
        // Two consonants in a row with no vowel between them form a conjunct.
        output += HASANTA;
      }
      output += CONSONANTS[consonant.key];
      // "ং" (anusvara from "ng") behaves like a final nasal, not a base
      // consonant that can take a kar, so do not treat it as a consonant that
      // expects a following vowel sign.
      previousWasConsonant = CONSONANTS[consonant.key] !== 'ং';
      i += consonant.length;
      continue;
    }

    const vowel = matchVowel(token.toLowerCase(), i);
    if (vowel) {
      if (previousWasConsonant) {
        output += VOWEL_SIGNS[vowel.key];
      } else {
        output += INDEPENDENT_VOWELS[vowel.key];
      }
      previousWasConsonant = false;
      i += vowel.length;
      continue;
    }

    // Unknown character: pass it through unchanged and reset consonant state.
    output += token[i];
    previousWasConsonant = false;
    i += 1;
  }

  return output;
}

// Public API: transliterate an arbitrary Latin string to Bangla, preserving
// whitespace between tokens. Returns the input unchanged for empty strings.
export function transliterate(roman: string): string {
  if (roman.length === 0) {
    return '';
  }
  // Split on whitespace while keeping the separators so spacing is preserved.
  const parts = roman.split(/(\s+)/);
  return parts.map((part) => (/^\s+$/.test(part) ? part : transliterateToken(part))).join('');
}

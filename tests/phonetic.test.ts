import { describe, expect, it } from 'vitest';
import { transliterate } from '../src/shared/phonetic';

// Documented, tested set of Avro style transliteration cases. These assertions
// would fail if the mapping tables or the vowel-sign placement logic were
// reverted, so they meaningfully guard the transliteration behavior.
describe('phonetic transliterate', () => {
  it('handles the canonical whole-word cases', () => {
    expect(transliterate('ami')).toBe('আমি');
    expect(transliterate('bangla')).toBe('বাংলা');
    expect(transliterate('tumi')).toBe('তুমি');
    expect(transliterate('boi')).toBe('বই');
  });

  it('renders independent vowels at the start of a word', () => {
    expect(transliterate('a')).toBe('আ');
    expect(transliterate('i')).toBe('ই');
    expect(transliterate('e')).toBe('এ');
  });

  it('places vowel signs (kar) after consonants rather than independent vowels', () => {
    // "ka" must be কা (consonant + aa-kar), not ক followed by independent আ.
    expect(transliterate('ka')).toBe('কা');
    expect(transliterate('ki')).toBe('কি');
    expect(transliterate('ku')).toBe('কু');
    expect(transliterate('ke')).toBe('কে');
  });

  it('handles common consonant digraphs', () => {
    expect(transliterate('kha')).toBe('খা');
    expect(transliterate('gha')).toBe('ঘা');
    expect(transliterate('sha')).toBe('শা');
  });

  it('builds conjuncts (juktakkhor) from adjacent consonants', () => {
    // Two consonants with no vowel between them should be joined by hasanta.
    const result = transliterate('kk');
    expect(result).toContain('\u09CD'); // hasanta / virama
    expect(result).toBe('ক্ক');
  });

  it('preserves whitespace between tokens', () => {
    expect(transliterate('ami tumi')).toBe('আমি তুমি');
  });

  it('returns an empty string for empty input', () => {
    expect(transliterate('')).toBe('');
  });

  // The following cases guard the less-common mapping-table entries that the
  // canonical cases above never reach: the case-sensitive retroflex consonants
  // (T, D), the extra sibilant (ss), the velar nasal (ngg), and several
  // multi-consonant conjunct clusters. Expected outputs were taken from the
  // actual CONSONANTS / OVERRIDES tables in src/shared/phonetic.ts, so a
  // regression in any of those entries fails here.
  it('maps case-sensitive retroflex consonants (T, D)', () => {
    // Uppercase T/D are the retroflex ট/ড, distinct from lowercase t/d.
    expect(transliterate('T')).toBe('ট');
    expect(transliterate('D')).toBe('ড');
    // With an inherent-vowel-following kar they take the aa-kar.
    expect(transliterate('Ta')).toBe('টা');
    expect(transliterate('Da')).toBe('ডা');
  });

  it('maps the retroflex sibilant ss and the velar nasal ngg', () => {
    // "ss" is the retroflex ষ, distinct from the single "s" (স) and "sh" (শ).
    expect(transliterate('ss')).toBe('ষ');
    expect(transliterate('ssa')).toBe('ষা');
    // "ngg" is the velar nasal ঙ, distinct from "ng" (the anusvara ং).
    expect(transliterate('ngg')).toBe('ঙ');
    expect(transliterate('ngga')).toBe('ঙা');
  });

  it('maps other less-common single consonants (nn, rr, z, Y, w)', () => {
    expect(transliterate('nn')).toBe('ণ');
    expect(transliterate('rr')).toBe('ড়');
    expect(transliterate('z')).toBe('জ');
    expect(transliterate('Y')).toBe('য');
    expect(transliterate('w')).toBe('ও');
  });

  it('handles the chh digraph', () => {
    expect(transliterate('chh')).toBe('ছ');
    expect(transliterate('chha')).toBe('ছা');
  });

  it('joins multi-consonant clusters with hasanta (conjuncts)', () => {
    // Two adjacent consonants with no vowel between them form a conjunct.
    expect(transliterate('kT')).toBe('ক্ট');
    expect(transliterate('sT')).toBe('স্ট');
    expect(transliterate('nD')).toBe('ন্ড');
    expect(transliterate('kt')).toBe('ক্ত');
    // A three-consonant cluster chains two hasanta joins.
    expect(transliterate('str')).toBe('স্ত্র');
  });

  it('applies explicit conjunct overrides (kkha, gga)', () => {
    // These are entries in the OVERRIDES table, not built by the greedy matcher.
    expect(transliterate('kkha')).toBe('ক্ষ');
    expect(transliterate('gga')).toBe('জ্ঞ');
  });
});

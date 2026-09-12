import { describe, expect, it } from 'vitest';
import { transliterate } from '../src/main/dictionary/phonetic';

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
});

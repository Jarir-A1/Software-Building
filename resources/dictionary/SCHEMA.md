# WordSetu Dictionary Data Schema

This document describes the JSON schema for the bundled WordSetu dictionary data
file (`entries.json`). The schema is intentionally simple, self documenting, and
versioned so future migrations are possible.

## Top level object (`DictionaryFile`)

| Field      | Type                | Required | Description                                             |
| ---------- | ------------------- | -------- | ------------------------------------------------------- |
| `version`  | `number`            | yes      | Schema version of this data file. Currently `1`.        |
| `language` | `string`            | yes      | Language pair identifier, for example `"bn-en"`.        |
| `entries`  | `DictionaryEntry[]` | yes      | The full list of dictionary entries.                    |

## `DictionaryEntry`

| Field              | Type          | Required | Description                                                        |
| ------------------ | ------------- | -------- | ------------------------------------------------------------------ |
| `id`               | `string`      | yes      | Stable unique ASCII slug. Never localized. Used for direct lookup. |
| `headword`         | `string`      | yes      | The Bangla headword. Stored as UTF-8, normalized to NFC on load.   |
| `headwordRoman`    | `string`      | no       | Latin romanization of the headword.                                |
| `partOfSpeech`     | `string`      | no       | Part of speech, for example `noun`, `verb`, `adjective`.           |
| `pronunciationIPA` | `string`      | no       | IPA pronunciation string.                                          |
| `senses`           | `Sense[]`     | yes      | One or more senses. At least one is required.                      |
| `synonyms`         | `string[]`    | no       | Bangla synonyms.                                                   |
| `antonyms`         | `string[]`    | no       | Bangla antonyms.                                                   |
| `examples`         | `Example[]`   | no       | Usage examples.                                                    |
| `tags`             | `string[]`    | no       | Free form tags, for example `common`, `formal`.                    |

## `Sense`

| Field          | Type     | Required | Description                                  |
| -------------- | -------- | -------- | -------------------------------------------- |
| `definitionBn` | `string` | yes      | The definition written in Bangla.            |
| `definitionEn` | `string` | no       | English definition or gloss for this sense.  |

## `Example`

| Field | Type     | Required | Description                          |
| ----- | -------- | -------- | ------------------------------------ |
| `bn`  | `string` | yes      | Example sentence in Bangla.          |
| `en`  | `string` | no       | English translation of the example. |

## Validation rules

The loader (`src/main/dictionary/loader.ts`) enforces the following and throws a
`DictionaryValidationError` (collecting every problem) when any rule is violated:

- `entries` must be an array.
- Each entry must have a non empty string `id`.
- Ids must be unique across the file.
- Each entry must have a non empty `headword`.
- Each entry must have at least one sense, and every sense must have a non empty
  `definitionBn`.

## Normalization

- Bangla text is normalized to Unicode NFC on load so headword and token
  comparisons are stable regardless of the source encoding.
- English text is case folded (lowercased) and trimmed for case insensitive
  cross language lookup.

## Indexes built on load

- `byId`: entry id to entry.
- `byHeadword`: normalized Bangla headword to entry ids.
- `sortedHeadwords` + `headwordToIds`: sorted headwords for prefix search.
- `banglaTokenIndex`: Bangla tokens (from headwords and synonyms) to entry ids.
- `englishIndex`: English tokens (from glosses and English definitions) to entry
  ids, for English to Bangla lookup.

## Example entry

```json
{
  "id": "boi",
  "headword": "বই",
  "headwordRoman": "boi",
  "partOfSpeech": "noun",
  "pronunciationIPA": "boi",
  "senses": [
    {
      "definitionBn": "ছাপানো বা লেখা পৃষ্ঠার বাঁধাই করা সংকলন।",
      "definitionEn": "book"
    }
  ],
  "synonyms": ["পুস্তক", "গ্রন্থ"],
  "examples": [{ "bn": "আমি একটি বই পড়ছি।", "en": "I am reading a book." }],
  "tags": ["common"]
}
```

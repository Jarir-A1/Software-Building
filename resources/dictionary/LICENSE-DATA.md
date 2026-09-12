# WordSetu Dictionary Data License

## Seed data (`entries.json`)

The seed dictionary data shipped in `entries.json` is **original content**
authored specifically for WordSetu. Every headword, definition, romanization,
example sentence, and gloss was written from scratch and is **not copied from any
copyrighted dictionary**.

The seed data is released into the public domain under the
[Creative Commons CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/)
dedication. To the extent possible under law, the WordSetu authors have waived
all copyright and related rights to the seed data. You may copy, modify,
distribute, and use it, even for commercial purposes, without asking permission.

## Expanding the dictionary with openly licensed corpora

The seed set is a starting point. To grow WordSetu into a comprehensive
dictionary, integrate additional entries only from sources whose licenses permit
redistribution, and record attribution as required. Recommended openly licensed
sources:

### Bangla WordNet (IndoWordNet)

- Project: IndoWordNet / Bangla WordNet, maintained by IIT Bombay and partners.
- Typical license: Creative Commons Attribution (CC BY) family. **Verify the
  exact license of the specific release you download before shipping it.**
- Attribution requirement: when using CC BY data you must credit the original
  authors and link the license. Add an attribution block to this file and an
  in app credits screen naming IndoWordNet and the release version.

### Other candidate sources

- Wiktionary (Bangla and English entries): dual licensed CC BY-SA 3.0 and GFDL.
  CC BY-SA is **share alike**, so derived data must carry the same license.
  Keep such data in a clearly separated data pack, not mixed with the CC0 seed.
- Open Multilingual Wordnet (OMW): aggregates wordnets under a range of open
  licenses; check per language license terms.

## Integration checklist for added data

1. Confirm the source license permits redistribution (and commercial use if
   WordSetu is sold).
2. Keep share alike (CC BY-SA) data in a separate, clearly labeled data pack so
   it never contaminates the CC0 seed.
3. Record the source name, release/version, URL, license, and download date in
   an attribution section of this file.
4. Surface required attributions in the application's About / Credits screen.
5. Re run the loader validation and the full test suite after importing new data.

## Attribution log

_No third party data has been added yet. All current entries are original CC0
content by the WordSetu authors._

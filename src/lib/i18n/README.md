# UI Translation Dictionary

Plain-data dictionary mechanism for user-facing texts without external dependencies. Pages will migrate to `t(locale, key, params?)` after the teammate's design trail merges.

## Adding a Key
1. Declare the key in `TranslationKey` in `types.ts`.
2. Add the English text in `en.ts` (enforced at compile time).
3. If ordinary UI text, add draft Finnish in `fi.ts` with `{ text, reviewed: false }`.

## Adding a Language
1. Add the locale code to `SUPPORTED_LOCALES` in `types.ts`.
2. Create `<locale>.ts` with `PartialDictionary`.
3. Register the dictionary in `DICTIONARIES` in `index.ts`.

## Restricted Groups (Never Machine-Translate)
Leave these absent as missing keys in non-English dictionaries:
- Every text of the crisis path, emergency numbers, and helpline services.
- PHQ-9 and tap questionnaire wording and answer options (require official clinical sources).
- Camera group texts, model descriptions, and what the camera measures.

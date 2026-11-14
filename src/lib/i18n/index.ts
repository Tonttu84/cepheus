/**
 * Plain, typed i18n dictionary mechanism for UI strings.
 *
 * Imports nothing from server or database; zero dependencies.
 */

import { EN_DICTIONARY } from "./en";
import { FI_DICTIONARY } from "./fi";
import {
  SUPPORTED_LOCALES,
  type DictionaryEntry,
  type Locale,
  type PartialDictionary,
  type TranslationKey,
} from "./types";

export * from "./types";
export { EN_DICTIONARY } from "./en";
export { FI_DICTIONARY } from "./fi";

const DICTIONARIES: Record<Locale, PartialDictionary> = {
  en: EN_DICTIONARY,
  fi: FI_DICTIONARY,
};

/**
 * Checks whether the given string is a supported locale.
 */
export function isSupportedLocale(locale: string): locale is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(locale);
}

/**
 * Asserts that the locale is supported, or throws an error.
 * Refuses unknown locales immediately; never falls back silently.
 */
export function assertSupportedLocale(
  locale: string
): asserts locale is Locale {
  if (!isSupportedLocale(locale)) {
    throw new Error(
      `Unsupported locale: "${locale}". Supported locales are: ${SUPPORTED_LOCALES.join(", ")}.`
    );
  }
}

/**
 * Extracts string text from a string or TranslationItem.
 */
function getEntryText(entry: DictionaryEntry | undefined): string | undefined {
  if (entry === undefined) return undefined;
  if (typeof entry === "string") return entry;
  return entry.text;
}

/**
 * Fills simple `{name}` placeholders from params.
 * Any placeholder not provided in params is left visible as `{placeholder}`.
 */
export function interpolatePlaceholders(
  text: string,
  params?: Record<string, string | number>
): string {
  if (!params) return text;
  return text.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, paramName) => {
    if (Object.prototype.hasOwnProperty.call(params, paramName)) {
      const val = params[paramName];
      if (val !== undefined && val !== null) {
        return String(val);
      }
    }
    return match;
  });
}

/**
 * Translates a key for a given locale with optional placeholder interpolation.
 * If the key has no text in the requested locale, returns `[missing: key]`.
 * Never falls back silently to English for missing keys.
 * Refuses unsupported locales with an Error.
 */
export function t(
  locale: Locale | string,
  key: TranslationKey | string,
  params?: Record<string, string | number>
): string {
  assertSupportedLocale(locale);

  const dict = DICTIONARIES[locale];
  const entry = dict[key as TranslationKey];
  const rawText = getEntryText(entry);

  if (rawText === undefined || rawText === null || rawText.trim() === "") {
    return `[missing: ${key}]`;
  }

  return interpolatePlaceholders(rawText, params);
}

/**
 * Reports all keys from the dictionary that are missing or empty in the given locale.
 * Refuses unsupported locales with an Error.
 */
export function listMissingKeys(locale: Locale | string): TranslationKey[] {
  assertSupportedLocale(locale);

  const dict = DICTIONARIES[locale];
  const allKeys = Object.keys(EN_DICTIONARY) as TranslationKey[];
  const missing: TranslationKey[] = [];

  for (const key of allKeys) {
    const text = getEntryText(dict[key]);
    if (text === undefined || text === null || text.trim() === "") {
      missing.push(key);
    }
  }

  return missing;
}

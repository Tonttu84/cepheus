import { describe, it, expect } from "vitest";
import {
  t,
  listMissingKeys,
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type Locale,
  type TranslationKey,
} from "../index";
import { EN_DICTIONARY } from "../en";
import { FI_DICTIONARY } from "../fi";

describe("i18n translation dictionary", () => {
  it("defines default locale as English and supports en and fi", () => {
    expect(DEFAULT_LOCALE).toBe("en");
    expect(SUPPORTED_LOCALES).toEqual(["en", "fi"]);
  });

  it("English has every key without any missing keys", () => {
    const missingInEn = listMissingKeys("en");
    expect(missingInEn).toEqual([]);
    expect(Object.keys(EN_DICTIONARY).length).toBeGreaterThan(50);
  });

  it("returns [missing: key] marker when a key is missing in the requested language", () => {
    // Non-existent key in English
    const markerUnknown = t("en", "nonexistent.key" as TranslationKey);
    expect(markerUnknown).toBe("[missing: nonexistent.key]");

    // Key deliberately omitted from Finnish (crisis path)
    const markerFiMissing = t("fi", "crisisBar.heading");
    expect(markerFiMissing).toBe("[missing: crisisBar.heading]");
  });

  it("fills known placeholders and leaves unknown placeholders visible", () => {
    // Known placeholder filled
    const filled = t("en", "demo.latestRound.completed", {
      date: "2026-11-14",
      weekNumber: 3,
    });
    expect(filled).toContain("2026-11-14");
    expect(filled).toContain("Week 3");

    // Partial params: known replaced, unknown preserved
    const partial = t("en", "demo.latestRound.completed", {
      date: "2026-11-14",
    });
    expect(partial).toContain("2026-11-14");
    expect(partial).toContain("{weekNumber}");

    // Custom test with unmatched placeholder
    const withUnmatched = t("en", "home.hero.participant", {
      label: "Participant A",
      unexpected: "value",
    });
    expect(withUnmatched).toBe("Participant: Participant A");
  });

  it("refuses an unknown locale with an error, never falling back to English silently", () => {
    const invalidLocales = ["de", "fr", "es", "sv", "unknown", ""];

    for (const loc of invalidLocales) {
      expect(() => t(loc as Locale, "nav.overview")).toThrow(
        /unsupported locale/i
      );
      expect(() => listMissingKeys(loc as Locale)).toThrow(
        /unsupported locale/i
      );
    }
  });

  it("asserts every crisis-path key is completely absent from fi.ts", () => {
    // Crisis path keys must never be machine-translated
    const crisisKeys = Object.keys(EN_DICTIONARY).filter(
      (key) =>
        key.startsWith("crisisBar.") ||
        key.startsWith("crisis.") ||
        key.includes("emergency") ||
        key.includes("crisis")
    ) as TranslationKey[];

    expect(crisisKeys.length).toBeGreaterThan(0);

    for (const key of crisisKeys) {
      expect(
        FI_DICTIONARY[key],
        `Crisis path key "${key}" must be absent from fi.ts`
      ).toBeUndefined();
    }
  });

  it("asserts PHQ-9 and tap questionnaire wording are completely absent from fi.ts", () => {
    // Question wording and options require official clinical translations
    const questionnaireKeys = Object.keys(EN_DICTIONARY).filter(
      (key) =>
        key.startsWith("instruments.phq9.") ||
        key.startsWith("instruments.tap.") ||
        key.startsWith("checkIn.items.")
    ) as TranslationKey[];

    expect(questionnaireKeys.length).toBeGreaterThan(0);

    for (const key of questionnaireKeys) {
      expect(
        FI_DICTIONARY[key],
        `Questionnaire key "${key}" must be absent from fi.ts`
      ).toBeUndefined();
    }
  });

  it("asserts camera measurement descriptions are completely absent from fi.ts", () => {
    // Statements describing what camera measures require checked translations
    const cameraMeasurementKeys = Object.keys(EN_DICTIONARY).filter(
      (key) =>
        key.startsWith("camera.measures.") ||
        key.startsWith("camera.completed.measures.") ||
        key.startsWith("camera.metrics.") ||
        key.includes(".measures.")
    ) as TranslationKey[];

    expect(cameraMeasurementKeys.length).toBeGreaterThan(0);

    for (const key of cameraMeasurementKeys) {
      expect(
        FI_DICTIONARY[key],
        `Camera measurement key "${key}" must be absent from fi.ts`
      ).toBeUndefined();
    }
  });

  it("asserts every camera group key is completely absent from fi.ts", () => {
    // Camera group keys must never be machine-translated until checked
    const cameraKeys = Object.keys(EN_DICTIONARY).filter((key) =>
      key.startsWith("camera.")
    ) as TranslationKey[];

    expect(cameraKeys.length).toBeGreaterThan(0);

    for (const key of cameraKeys) {
      expect(
        FI_DICTIONARY[key],
        `Camera group key "${key}" must be absent from fi.ts`
      ).toBeUndefined();
    }
  });

  it("lists all missing keys in Finnish and verifies draft entries are marked unreviewed", () => {
    const totalEnKeys = Object.keys(EN_DICTIONARY).length;
    const missingInFi = listMissingKeys("fi");
    expect(totalEnKeys).toBe(308);
    expect(missingInFi).toHaveLength(159);

    // Verify draft entries in Finnish dictionary have reviewed: false
    for (const [key, entry] of Object.entries(FI_DICTIONARY)) {
      if (entry !== undefined) {
        if (typeof entry === "object" && "reviewed" in entry) {
          expect(
            entry.reviewed,
            `Finnish entry for "${key}" should be marked reviewed: false`
          ).toBe(false);
        }
      }
    }
  });
});

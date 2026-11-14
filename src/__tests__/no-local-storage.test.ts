import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Case 1 (D45): nothing is kept on the person's device. No source file may use
 * browser storage, the Cache API or cookies written from script. Test files are
 * skipped because they may name these APIs to check them.
 */
const SRC_DIR = resolve(__dirname, "..");

const FORBIDDEN: readonly { name: string; pattern: RegExp }[] = [
  { name: "localStorage", pattern: /\blocalStorage\b/ },
  { name: "sessionStorage", pattern: /\bsessionStorage\b/ },
  { name: "indexedDB", pattern: /\bindexedDB\b/ },
  { name: "Cache API", pattern: /\bcaches\s*\.\s*(open|match|keys|has|delete)\b/ },
  { name: "document.cookie", pattern: /\bdocument\s*\.\s*cookie\b/ },
];

function isTestPath(path: string): boolean {
  return /[\\/]__tests__[\\/]/.test(path) || /\.(test|dbtest)\.tsx?$/.test(path);
}

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : listSourceFiles(full);
    return /\.(ts|tsx|js|jsx|mjs)$/.test(entry.name) && !isTestPath(full) ? [full] : [];
  });
}

function findForbiddenUses(files: readonly string[]): string[] {
  return files.flatMap((file) =>
    readFileSync(file, "utf8")
      .split(/\r?\n/)
      .flatMap((line, i) =>
        FORBIDDEN.filter((f) => f.pattern.test(line)).map(
          (f) => `${relative(SRC_DIR, file)}:${i + 1} uses ${f.name}`
        )
      )
  );
}

describe("No local storage on device (Case 1)", () => {
  it("scans a non-trivial set of source files", () => {
    const files = listSourceFiles(SRC_DIR);
    expect(files.length).toBeGreaterThan(20);
    expect(files.some((f) => f.endsWith("check-in-interactive.tsx"))).toBe(true);
    expect(files.some(isTestPath)).toBe(false);
  });

  it("no source file under src/ uses browser storage, the Cache API or document.cookie", () => {
    expect(findForbiddenUses(listSourceFiles(SRC_DIR))).toEqual([]);
  });
});

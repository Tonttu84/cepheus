import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT_DIR = resolve(__dirname, "../..");
const SRC_DIR = resolve(ROOT_DIR, "src");

/**
 * Files outside src/server/db/ that currently talk directly to the database.
 * Every entry must continue to talk to the database until refactored behind
 * the use cases and ports in src/usecases (decision D43). This list can only shrink.
 */
export const LEGACY_EXCEPTIONS: readonly string[] = [
  // Checks database connectivity by counting participant records for the health check endpoint.
  "src/app/api/health/route.ts",
  // Looks up participant by external ID to show current demo/session status on the landing page.
  "src/app/page.tsx",
  // Resolves participant ID and clinic ID by participant code for patient authentication.
  "src/server/auth/eid-provider.ts",
  // Verifies clinic and staff user credentials against database records during staff login.
  "src/server/auth/staff-auth.ts",
  // Directly reads and writes monitoring streams, rhythm windows, consent, and participant data.
  "src/server/monitoring/store.ts",
];

/**
 * Strips comments from JavaScript/TypeScript source code while preserving
 * string literals.
 */
export function stripComments(source: string): string {
  const commentOrString =
    /\/\*[\s\S]*?\*\/|\/\/[^\r\n]*|(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)/g;

  return source.replace(commentOrString, (match) => {
    if (match.startsWith("//") || match.startsWith("/*")) {
      return " ";
    }
    return match;
  });
}

/**
 * Replaces string literals that are not import specifiers with empty strings,
 * so string contents do not produce false matches for import statements.
 */
export function stripNonImportStrings(sourceWithoutComments: string): string {
  const stringRe =
    /(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)/g;

  return sourceWithoutComments.replace(stringRe, (match, offset) => {
    // Only inspect the immediate preceding characters (at most 100 chars)
    const windowStart = Math.max(0, offset - 100);
    const preceding = sourceWithoutComments.slice(windowStart, offset);
    const isImportSpecifier =
      /\bfrom\s*$/.test(preceding) ||
      /\bimport\s*$/.test(preceding) ||
      /\bimport\s*\(\s*$/.test(preceding) ||
      /\brequire\s*\(\s*$/.test(preceding);

    return isImportSpecifier ? match : '""';
  });
}

/**
 * Extracts module specifiers from static imports (excluding `import type ... from`),
 * dynamic `import(...)`, and `require(...)`.
 */
export function extractImportSpecifiers(source: string): string[] {
  const sanitized = stripNonImportStrings(stripComments(source));
  const specs: string[] = [];

  const STATIC_IMPORT_RE =
    /\bimport\s+(?:["'](?<sideSpec>[^"']+)["']|(?!type\b)(?:[^;]*?\bfrom\s*)["'](?<fromSpec>[^"']+)["'])/g;
  const DYNAMIC_IMPORT_RE =
    /\bimport\s*\(\s*["'`](?<spec>[^"'`]+)["'`]\s*\)/g;
  const REQUIRE_RE =
    /\brequire\s*\(\s*["'`](?<spec>[^"'`]+)["'`]\s*\)/g;

  let match: RegExpExecArray | null;
  while ((match = STATIC_IMPORT_RE.exec(sanitized)) !== null) {
    const spec = match.groups?.sideSpec ?? match.groups?.fromSpec;
    if (spec) specs.push(spec);
  }
  while ((match = DYNAMIC_IMPORT_RE.exec(sanitized)) !== null) {
    if (match.groups?.spec) specs.push(match.groups.spec);
  }
  while ((match = REQUIRE_RE.exec(sanitized)) !== null) {
    if (match.groups?.spec) specs.push(match.groups.spec);
  }

  return specs;
}

/**
 * Determines whether an imported module specifier refers to Prisma or src/lib/db.
 */
export function isDatabaseSpecifier(
  specifier: string,
  filePath: string,
  rootDir: string = ROOT_DIR
): boolean {
  if (specifier === "@prisma/client" || specifier.startsWith("@prisma/client/")) {
    return true;
  }
  if (
    specifier === "@/lib/db" ||
    specifier === "@/lib/db.ts" ||
    specifier === "@/lib/db.js"
  ) {
    return true;
  }
  if (specifier.startsWith(".")) {
    const srcDir = resolve(rootDir, "src");
    const targetNoExt = resolve(srcDir, "lib", "db").replace(/\\/g, "/");
    const absFilePath = isAbsolute(filePath) ? filePath : resolve(rootDir, filePath);
    const fileDir = dirname(absFilePath);
    const resolved = resolve(fileDir, specifier)
      .replace(/\\/g, "/")
      .replace(/\.(ts|js|tsx|jsx)$/, "");
    if (resolved === targetNoExt) {
      return true;
    }
  }
  return false;
}

/**
 * Checks whether a source string talks to the database.
 */
export function talksToDatabase(
  source: string,
  filePath = "src/dummy.ts",
  rootDir: string = ROOT_DIR
): boolean {
  if (!source.includes("prisma") && !source.includes("db")) {
    return false;
  }
  const specs = extractImportSpecifiers(source);
  return specs.some((spec) => isDatabaseSpecifier(spec, filePath, rootDir));
}

/**
 * Recursively walks every .ts and .tsx file under a directory, skipping
 * node_modules, __tests__ directories, and test/dbtest files.
 */
export function walkSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "__tests__") {
        continue;
      }
      files.push(...walkSourceFiles(join(dir, entry.name)));
    } else if (entry.isFile()) {
      const name = entry.name;
      const isTsSource = name.endsWith(".ts") || name.endsWith(".tsx");
      const isTestFile =
        name.endsWith(".test.ts") ||
        name.endsWith(".test.tsx") ||
        name.endsWith(".dbtest.ts") ||
        name.endsWith(".dbtest.tsx");

      if (isTsSource && !isTestFile) {
        files.push(join(dir, name));
      }
    }
  }

  return files;
}

/**
 * Code allowed to talk directly to the database: everything under src/server/db/
 * and src/lib/db.ts itself.
 */
export function isAllowedDatabaseAccess(relPath: string): boolean {
  const normalized = relPath.replace(/\\/g, "/");
  return (
    normalized.startsWith("src/server/db/") ||
    normalized === "src/lib/db.ts"
  );
}

describe("storage boundary", () => {
  describe("database access scanner", () => {
    it("counts static import of db", () => {
      expect(talksToDatabase('import { getPrisma } from "@/lib/db";')).toBe(true);
      expect(talksToDatabase('import { PrismaClient } from "@prisma/client";')).toBe(true);
      expect(talksToDatabase('import "@prisma/client";')).toBe(true);
    });

    it("does not count import type", () => {
      expect(
        talksToDatabase('import type { PrismaClient } from "@prisma/client";')
      ).toBe(false);
      expect(
        talksToDatabase('import type { getPrisma } from "@/lib/db";')
      ).toBe(false);
      expect(
        talksToDatabase('import type PrismaClient from "@prisma/client";')
      ).toBe(false);
    });

    it("counts dynamic import", () => {
      expect(
        talksToDatabase('const mod = await import("@prisma/client");')
      ).toBe(true);
      expect(
        talksToDatabase('const mod = await import("@/lib/db");')
      ).toBe(true);
    });

    it("counts require", () => {
      expect(talksToDatabase('const mod = require("@prisma/client");')).toBe(true);
      expect(talksToDatabase('const mod = require("@/lib/db");')).toBe(true);
    });

    it("does not count import or require inside comments or string literals", () => {
      expect(talksToDatabase('// import { getPrisma } from "@/lib/db";')).toBe(false);
      expect(talksToDatabase('/* import { getPrisma } from "@/lib/db"; */')).toBe(false);
      expect(
        talksToDatabase('const msg = "import { getPrisma } from \\"@/lib/db\\"";')
      ).toBe(false);
      expect(
        talksToDatabase("const msg = 'require(\"@prisma/client\")';")
      ).toBe(false);
      expect(
        talksToDatabase("const msg = `import(\"@/lib/db\")`;")
      ).toBe(false);
      expect(talksToDatabase('// const p = require("@prisma/client");')).toBe(false);
    });

    it("counts relative import resolving to src/lib/db.ts", () => {
      expect(
        talksToDatabase('import { getPrisma } from "../lib/db";', "src/server/x.ts")
      ).toBe(true);
      expect(
        talksToDatabase(
          'import { getPrisma } from "../../lib/db";',
          "src/domain/sub/x.ts"
        )
      ).toBe(true);
    });

    it("does not count import of @/lib/dbx or @/lib/db-utils", () => {
      expect(talksToDatabase('import { something } from "@/lib/dbx";')).toBe(false);
      expect(talksToDatabase('import { something } from "@/lib/db-utils";')).toBe(false);
      expect(
        talksToDatabase('import { something } from "../lib/dbx";', "src/server/x.ts")
      ).toBe(false);
    });
  });

  describe("storage layer boundary enforcement", () => {
    it("Test A: only src/server/db may talk to the database (or files in LEGACY_EXCEPTIONS)", () => {
      const allSourceFiles = walkSourceFiles(SRC_DIR);
      const legacySet = new Set(LEGACY_EXCEPTIONS);
      const violations: string[] = [];

      for (const fullPath of allSourceFiles) {
        const relPath = relative(ROOT_DIR, fullPath).replace(/\\/g, "/");
        if (isAllowedDatabaseAccess(relPath) || legacySet.has(relPath)) {
          continue;
        }

        const content = readFileSync(fullPath, "utf8");
        if (talksToDatabase(content, relPath, ROOT_DIR)) {
          violations.push(
            `${relPath}: Only src/server/db may talk to the database. Read and write through the use cases and ports in src/usecases (decision D43). See docs/tasks.md.`
          );
        }
      }

      expect(violations).toEqual([]);
    });

    it("Test B: all legacy exceptions still exist and talk to the database", () => {
      for (const entry of LEGACY_EXCEPTIONS) {
        const fullPath = resolve(ROOT_DIR, entry);
        expect(
          existsSync(fullPath),
          `${entry} in LEGACY_EXCEPTIONS no longer exists. Remove it from LEGACY_EXCEPTIONS.`
        ).toBe(true);

        const content = readFileSync(fullPath, "utf8");
        expect(
          talksToDatabase(content, entry, ROOT_DIR),
          `${entry} in LEGACY_EXCEPTIONS no longer talks to the database. Remove it from LEGACY_EXCEPTIONS.`
        ).toBe(true);
      }
    });
  });
});

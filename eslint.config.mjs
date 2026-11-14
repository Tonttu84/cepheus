import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

/**
 * Custom inline ESLint plugin to enforce that files inside src/domain/
 * cannot import any module from outside src/domain/.
 */
const domainLayerPlugin = {
  rules: {
    "pure-domain-layer": {
      meta: {
        type: "problem",
        docs: {
          description: "Refuse any import in src/domain/** from outside src/domain/",
        },
        schema: [],
      },
      create(context) {
        return {
          ImportDeclaration(node) {
            const source = node.source.value;
            if (typeof source !== "string") return;

            // Allow imports within domain:
            // 1. Alias imports to domain: "@/domain/..."
            if (source === "@/domain" || source.startsWith("@/domain/")) {
              return;
            }

            // 2. Relative imports staying within src/domain/
            if (source.startsWith("./") || source.startsWith("../")) {
              const currentFilePath = context.filename || context.getFilename();
              const normalizedCurrent = currentFilePath.replace(/\\/g, "/");
              const resolved = path.posix.normalize(
                path.posix.join(path.posix.dirname(normalizedCurrent), source)
              );
              if (
                resolved.includes("/src/domain/") ||
                resolved.endsWith("/src/domain")
              ) {
                return;
              }
            }

            // 3. Test files may import the test runner, and nothing else from outside.
            const importingFile = (context.filename || context.getFilename()).replace(/\\/g, "/");
            const isTestFile = importingFile.includes("/__tests__/") || /\.test\.tsx?$/.test(importingFile);
            if (isTestFile && source === "vitest") {
              return;
            }

            // Any import from outside src/domain/ is refused
            context.report({
              node,
              message: `Layer rule violation: files in src/domain/ may not import "${source}" from outside src/domain/.`,
            });
          },
        };
      },
    },
  },
};

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  // Layer Rule 1: Refuse any import in src/domain/** from outside src/domain/
  {
    files: ["src/domain/**/*.{js,mjs,cjs,ts,tsx}"],
    plugins: {
      domain: domainLayerPlugin,
    },
    rules: {
      "domain/pure-domain-layer": "error",
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/lib/**",
                "@/server/**",
                "@/app/**",
                "@/components/**",
                "@prisma/**",
                "../lib/**",
                "../server/**",
                "../app/**",
                "../components/**",
                "../../**",
              ],
              message:
                "Layer rule violation: files in src/domain/ may not import from outside src/domain/.",
            },
          ],
        },
      ],
    },
  },

  // Layer Rule 2: Refuse any import of @prisma/client or src/lib/db outside
  // src/server/**, src/lib/db.ts itself, and prisma/**
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    ignores: [
      "src/server/**",
      "src/lib/db.ts",
      "prisma/**",
      // Explicit exceptions for existing files importing the database client
      // before server-layer refactoring is completed:
      "src/app/api/health/route.ts", // API health route
      "src/app/page.tsx", // Root demo page
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@prisma/client",
              message:
                "Layer rule violation: @prisma/client may only be imported inside src/server/**, src/lib/db.ts, or prisma/**.",
            },
            {
              name: "@/lib/db",
              message:
                "Layer rule violation: src/lib/db may only be imported inside src/server/**, src/lib/db.ts, or prisma/**.",
            },
            {
              name: "@/lib/db.ts",
              message:
                "Layer rule violation: src/lib/db may only be imported inside src/server/**, src/lib/db.ts, or prisma/**.",
            },
          ],
          patterns: [
            {
              group: ["**/lib/db", "**/lib/db.ts"],
              message:
                "Layer rule violation: src/lib/db may only be imported inside src/server/**, src/lib/db.ts, or prisma/**.",
            },
          ],
        },
      ],
    },
  },
  // Function shape (AGENTS.md, "Code"): guidance, so these are warnings and the gate
  // stays green. Raise one to an error only after the flagged code has been dealt with.
  {
    files: ["src/**/*.{ts,tsx}", "prisma/**/*.ts", "scripts/**/*.mjs", "e2e/**/*.ts"],
    rules: {
      complexity: ["warn", 15],
      "max-depth": ["warn", 3],
      "max-params": ["warn", 5],
    },
  },
  {
    files: ["src/**/*.ts", "prisma/**/*.ts", "scripts/**/*.mjs"],
    ignores: ["**/__tests__/**", "**/*.test.ts", "**/*.dbtest.ts"],
    rules: {
      "max-lines-per-function": [
        "warn",
        { max: 60, skipBlankLines: true, skipComments: true },
      ],
    },
  },
  {
    // Screen components carry markup, so they get more room.
    files: ["src/**/*.tsx"],
    ignores: ["**/__tests__/**", "**/*.test.tsx"],
    rules: {
      "max-lines-per-function": [
        "warn",
        { max: 150, skipBlankLines: true, skipComments: true },
      ],
    },
  },
];

export default eslintConfig;

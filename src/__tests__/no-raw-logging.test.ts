import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const SRC_DIR = resolve(__dirname, "..");

function isTestPath(path: string): boolean {
  return (
    /[\\/]__tests__[\\/]/.test(path) ||
    /\.(test|spec|dbtest)\.tsx?$/.test(path) ||
    /[\\/]testing[\\/]/.test(path)
  );
}

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "__tests__" ? [] : listSourceFiles(full);
    }
    return /\.(ts|tsx)$/.test(entry.name) && !isTestPath(full) ? [full] : [];
  });
}

const FORBIDDEN_ARG_NAMES = new Set([
  "body",
  "rawbody",
  "req",
  "request",
  "payload",
  "answer",
  "answers",
  "submission",
  "phq9",
  "gad7",
  "taps",
  "input",
  "participantcode",
  "participantid",
  "patientid",
  "token",
  "secret",
  "password",
  "email",
]);

const FORBIDDEN_PROPERTY_NAMES = new Set([
  "body",
  "rawbody",
  "answer",
  "answers",
  "submission",
  "mood",
  "interest",
  "itemvalue",
  "participantcode",
  "participantid",
  "patientid",
  "token",
  "secret",
  "password",
  "email",
  "cookie",
]);

export function findLoggingViolations(code: string, fileName = "code.ts"): string[] {
  const sourceFile = ts.createSourceFile(
    fileName,
    code,
    ts.ScriptTarget.Latest,
    true
  );

  const violations: string[] = [];

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      if (
        ts.isPropertyAccessExpression(expr) &&
        ts.isIdentifier(expr.expression) &&
        expr.expression.text === "console"
      ) {
        const method = expr.name.text;
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;

        for (const arg of node.arguments) {
          // Check direct identifier or member access
          if (ts.isIdentifier(arg)) {
            const lower = arg.text.toLowerCase();
            if (FORBIDDEN_ARG_NAMES.has(lower)) {
              violations.push(
                `${fileName}:${line} console.${method} passes forbidden variable directly: '${arg.text}'`
              );
            }
          } else if (ts.isPropertyAccessExpression(arg)) {
            const lowerProp = arg.name.text.toLowerCase();
            if (FORBIDDEN_ARG_NAMES.has(lowerProp)) {
              violations.push(
                `${fileName}:${line} console.${method} passes forbidden property directly: '${arg.getText(sourceFile)}'`
              );
            }
          } else if (ts.isObjectLiteralExpression(arg)) {
            for (const prop of arg.properties) {
              if (ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop)) {
                const propName = prop.name.getText(sourceFile).toLowerCase();
                if (FORBIDDEN_PROPERTY_NAMES.has(propName)) {
                  violations.push(
                    `${fileName}:${line} console.${method} logs forbidden sensitive key: '${prop.name.getText(sourceFile)}'`
                  );
                }

                // If property value is passing a raw answer or body expression
                if (ts.isPropertyAssignment(prop)) {
                  const valText = prop.initializer.getText(sourceFile).toLowerCase();
                  if (
                    propName === "value" &&
                    (valText.includes("input") || valText.includes("answer") || valText.includes("body"))
                  ) {
                    violations.push(
                      `${fileName}:${line} console.${method} logs raw answer value: '${prop.getText(sourceFile)}'`
                    );
                  }
                }
              }
            }
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

describe("Logging privacy & zero-PII scanner (Case 3)", () => {
  it("scans a non-trivial set of production source files", () => {
    const files = listSourceFiles(SRC_DIR);
    expect(files.length).toBeGreaterThan(30);
    expect(files.some((f) => f.includes("api"))).toBe(true);
    expect(files.some(isTestPath)).toBe(false);
  });

  describe("Scanner rule verification on test snippets", () => {
    it("flags console calls that pass request body or raw input directly", () => {
      const bad1 = 'console.log(body);';
      expect(findLoggingViolations(bad1)).toEqual([
        "code.ts:1 console.log passes forbidden variable directly: 'body'",
      ]);

      const bad2 = 'console.error("failed:", req.body);';
      expect(findLoggingViolations(bad2)).toEqual([
        "code.ts:1 console.error passes forbidden property directly: 'req.body'",
      ]);

      const bad3 = 'console.warn(input);';
      expect(findLoggingViolations(bad3)).toEqual([
        "code.ts:1 console.warn passes forbidden variable directly: 'input'",
      ]);
    });

    it("flags console calls that pass answer objects or participant codes", () => {
      const badAnswer = 'console.error("answer received", answer);';
      expect(findLoggingViolations(badAnswer)).toEqual([
        "code.ts:1 console.error passes forbidden variable directly: 'answer'",
      ]);

      const badObject = 'console.info({ participantCode: "P-123", status: "ok" });';
      expect(findLoggingViolations(badObject)).toEqual([
        "code.ts:1 console.info logs forbidden sensitive key: 'participantCode'",
      ]);

      const badMood = 'console.log({ kind: "taps", mood: 3 });';
      expect(findLoggingViolations(badMood)).toEqual([
        "code.ts:1 console.log logs forbidden sensitive key: 'mood'",
      ]);

      const badToken = 'console.error("auth failed", { token: "secret" });';
      expect(findLoggingViolations(badToken)).toEqual([
        "code.ts:1 console.error logs forbidden sensitive key: 'token'",
      ]);
    });

    it("allows safe non-identifying diagnostic logging", () => {
      const safe1 = 'console.warn("[verda] Inference fallback triggered:", { operation: "nurse_brief", errorKind: "rate_limit" });';
      expect(findLoggingViolations(safe1)).toEqual([]);

      const safe2 = 'console.error("[arduino/check-in] Storing failed:", { kind: "taps", date: "2026-11-14", isSimulated: true });';
      expect(findLoggingViolations(safe2)).toEqual([]);
    });
  });

  it("ensures no production file in src/ logs request bodies, answers, participant codes, or secrets", () => {
    const files = listSourceFiles(SRC_DIR);
    const allViolations: string[] = [];

    for (const file of files) {
      const code = readFileSync(file, "utf8");
      const violations = findLoggingViolations(code, relative(SRC_DIR, file));
      allViolations.push(...violations);
    }

    expect(allViolations).toEqual([]);
  });
});

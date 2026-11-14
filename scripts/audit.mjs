import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const AUDIT_TIMEOUT_MS = 30000;
const EXCEPTIONS_FILE = path.resolve(process.cwd(), "audit-exceptions.json");

/**
 * Loads and validates the audit-exceptions.json file.
 */
export function loadExceptions(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`Audit failed: exceptions file not found at ${filePath}`);
    process.exit(1);
  }

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) {
      throw new Error("Exceptions file must contain a JSON array");
    }
    return data;
  } catch (err) {
    console.error(`Audit failed: unable to read ${filePath}: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Extracts a canonical advisory identifier from an advisory object.
 */
export function extractAdvisoryId(viaItem) {
  if (!viaItem || typeof viaItem !== "object") {
    return null;
  }
  if (viaItem.id) {
    return String(viaItem.id).trim();
  }
  if (viaItem.advisoryId) {
    return String(viaItem.advisoryId).trim();
  }
  if (typeof viaItem.url === "string") {
    const ghsaMatch = viaItem.url.match(/GHSA-[a-z0-9-]+/i);
    if (ghsaMatch) {
      return ghsaMatch[0].toUpperCase();
    }
  }
  if (typeof viaItem.source === "string") {
    const ghsaMatch = viaItem.source.match(/GHSA-[a-z0-9-]+/i);
    if (ghsaMatch) {
      return ghsaMatch[0].toUpperCase();
    }
    return viaItem.source.trim();
  }
  if (typeof viaItem.source === "number") {
    return String(viaItem.source);
  }
  if (typeof viaItem.url === "string" && viaItem.url.trim()) {
    return viaItem.url.trim();
  }
  return null;
}

/**
 * Checks if an advisory matches an entry in audit-exceptions.json.
 */
export function matchesException(advisoryPkg, advisoryId, exceptions) {
  if (!advisoryId) {
    return false;
  }
  const normId = advisoryId.toUpperCase();
  return exceptions.some((exc) => {
    const excId = String(exc.id || exc.advisoryId || "").trim().toUpperCase();
    if (!excId || excId !== normId) {
      return false;
    }
    if (exc.package && exc.package !== advisoryPkg) {
      return false;
    }
    return true;
  });
}

/**
 * Follows the via chain recursively to collect all advisory objects.
 */
function resolveAdvisories(vuln, allVulns, visited = new Set()) {
  const advisories = [];
  const viaList = Array.isArray(vuln.via) ? vuln.via : [];

  for (const item of viaList) {
    if (item && typeof item === "object") {
      advisories.push(item);
    } else if (typeof item === "string") {
      if (visited.has(item)) {
        continue;
      }
      visited.add(item);
      const targetVuln = allVulns[item];
      if (targetVuln) {
        advisories.push(...resolveAdvisories(targetVuln, allVulns, visited));
      }
    }
  }

  return advisories;
}

/**
 * Pure function that evaluates the audit JSON against exceptions and returns unexpected findings.
 */
export function findUnexpectedAuditFindings(reportOrJson, exceptions = []) {
  let report = reportOrJson;
  if (typeof reportOrJson === "string") {
    try {
      report = JSON.parse(reportOrJson);
    } catch {
      return [
        {
          package: "audit",
          severity: "critical",
          id: "unreadable-json",
          title: "Audit output is not valid JSON",
        },
      ];
    }
  }

  if (!report || typeof report !== "object" || Array.isArray(report)) {
    return [
      {
        package: "audit",
        severity: "critical",
        id: "unreadable-json",
        title: "Audit output is not an object",
      },
    ];
  }

  if (report.error) {
    return [
      {
        package: "audit",
        severity: "critical",
        id: "audit-error",
        title: `npm audit error: ${report.error.summary || report.error.detail || report.error.code || "unknown"}`,
      },
    ];
  }

  const vulnerabilities = report.vulnerabilities || {};
  const unexpected = [];
  const recorded = new Set();

  for (const [pkgName, vuln] of Object.entries(vulnerabilities)) {
    const isHighOrCritical =
      vuln.severity === "high" || vuln.severity === "critical";

    if (!isHighOrCritical) {
      continue;
    }

    const advisories = resolveAdvisories(vuln, vulnerabilities);

    if (advisories.length === 0) {
      // High or critical vulnerability with no resolvable advisory objects
      const key = `${pkgName}:no-advisory-id`;
      if (!recorded.has(key)) {
        recorded.add(key);
        unexpected.push({
          package: pkgName,
          severity: vuln.severity,
          id: null,
          title: "No advisory ID could be read from audit output",
        });
      }
      continue;
    }

    for (const adv of advisories) {
      const isFindingHigh =
        adv.severity === "high" || adv.severity === "critical" || !adv.severity;
      if (!isFindingHigh) {
        continue;
      }

      const advPkg = adv.name || adv.dependency || pkgName;
      const advId = extractAdvisoryId(adv);

      if (!advId) {
        const key = `${advPkg}:no-id`;
        if (!recorded.has(key)) {
          recorded.add(key);
          unexpected.push({
            package: advPkg,
            severity: adv.severity || vuln.severity,
            id: null,
            title: adv.title || "No readable advisory ID",
          });
        }
        continue;
      }

      if (!matchesException(advPkg, advId, exceptions)) {
        const key = `${advPkg}:${advId}`;
        if (!recorded.has(key)) {
          recorded.add(key);
          unexpected.push({
            package: advPkg,
            severity: adv.severity || vuln.severity,
            id: advId,
            title: adv.title || "Unaccepted advisory",
          });
        }
      }
    }
  }

  return unexpected;
}

/**
 * Runs npm audit with --omit=dev --json and handles timeouts and network failures.
 */
function runAuditCommand(timeoutMs) {
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npmCmd, ["audit", "--omit=dev", "--json"], {
    encoding: "utf-8",
    timeout: timeoutMs,
    shell: true,
  });

  if (result.error) {
    if (result.error.code === "ETIMEDOUT") {
      console.error(
        `Audit failed: npm audit timed out after ${timeoutMs / 1000} seconds.`
      );
    } else {
      console.error(
        `Audit failed: unable to execute npm audit: ${result.error.message}`
      );
    }
    process.exit(1);
  }

  const stdout = (result.stdout || "").trim();
  if (!stdout) {
    const stderr = (result.stderr || "").trim();
    console.error(
      `Audit failed: npm audit produced no output (offline or registry unreachable).\n${stderr}`
    );
    process.exit(1);
  }

  return stdout;
}

/**
 * Main execution flow.
 */
function main() {
  const exceptions = loadExceptions(EXCEPTIONS_FILE);
  const auditStdout = runAuditCommand(AUDIT_TIMEOUT_MS);
  const unexpected = findUnexpectedAuditFindings(auditStdout, exceptions);

  if (unexpected.length > 0) {
    console.error(
      `Audit failed: ${unexpected.length} unaccepted high/critical finding(s) detected:`
    );
    for (const f of unexpected) {
      console.error(
        `  - [${(f.severity || "HIGH").toUpperCase()}] ${f.package}: ${f.id || "no-advisory-id"} (${f.title || "no title"})`
      );
    }
    process.exit(1);
  }

  console.log(
    `Audit passed: known finding(s) accepted, 0 unexpected high/critical findings.`
  );
}

const isMainModule =
  typeof process !== "undefined" &&
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  main();
}

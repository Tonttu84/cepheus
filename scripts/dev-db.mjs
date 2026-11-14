import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";

const platformPackages = {
  "win32-x64": "@embedded-postgres/windows-x64",
  "darwin-arm64": "@embedded-postgres/darwin-arm64",
  "darwin-x64": "@embedded-postgres/darwin-x64",
  "linux-x64": "@embedded-postgres/linux-x64",
  "linux-arm64": "@embedded-postgres/linux-arm64",
  "linux-arm": "@embedded-postgres/linux-arm",
  "linux-ia32": "@embedded-postgres/linux-ia32",
  "linux-ppc64": "@embedded-postgres/linux-ppc64",
};

/**
 * Resolves the platform package for embedded PostgreSQL binaries.
 * Throws a descriptive error when no binary package is available for the current architecture.
 */
export async function getPlatformBins() {
  const platformKey = `${process.platform}-${process.arch}`;
  const pkgName = platformPackages[platformKey];
  if (!pkgName) {
    throw new Error(
      `No prebuilt embedded PostgreSQL binary package for platform "${platformKey}". ` +
        `Supported platforms: ${Object.keys(platformPackages).join(", ")}`
    );
  }
  try {
    return await import(pkgName);
  } catch (error) {
    throw new Error(
      `Failed to load embedded PostgreSQL binaries from "${pkgName}": ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Resolves the port from DEV_DB_PORT, DATABASE_URL, or defaults to 5433.
 */
export function resolvePort(explicitPort) {
  if (explicitPort) {
    return String(explicitPort);
  }
  if (process.env.DEV_DB_PORT) {
    return String(process.env.DEV_DB_PORT);
  }
  if (process.env.DATABASE_URL) {
    try {
      const parsed = new URL(process.env.DATABASE_URL);
      if (parsed.port) {
        return parsed.port;
      }
    } catch {
      // Ignore invalid DATABASE_URL and use default port
    }
  }
  return "5433";
}

/**
 * Runs an executable with a timeout and returns its stdout.
 */
function runCommand(bin, args, options = {}) {
  return execFileSync(bin, args, {
    stdio: "pipe",
    timeout: 60_000,
    ...options,
  }).toString();
}

/**
 * Checks the status of the PostgreSQL cluster at the given data directory.
 * Returns "running", "stopped", or throws on unexpected error.
 */
export async function getStatus(options = {}) {
  const bins = options.bins ?? (await getPlatformBins());
  const dataDir = path.resolve(options.dataDir ?? process.env.DEV_DB_DIR ?? ".pgdata");

  if (!existsSync(path.join(dataDir, "PG_VERSION"))) {
    return "stopped";
  }

  try {
    runCommand(bins.pg_ctl, ["status", "-D", dataDir], { timeout: 15_000 });
    return "running";
  } catch (error) {
    if (error && typeof error === "object" && "status" in error && error.status === 3) {
      return "stopped";
    }
    const exitCode = error && typeof error === "object" && "status" in error ? error.status : "unknown";
    return `unknown (exit ${exitCode})`;
  }
}

/**
 * Initialises the database cluster directory if it does not yet exist.
 */
export async function initDb(options = {}) {
  const bins = options.bins ?? (await getPlatformBins());
  const dataDir = path.resolve(options.dataDir ?? process.env.DEV_DB_DIR ?? ".pgdata");
  const user = options.user ?? "cepheus";
  const password = options.password ?? "cepheus-local-only";

  if (existsSync(path.join(dataDir, "PG_VERSION"))) {
    return "already_initialised";
  }

  mkdirSync(dataDir, { recursive: true });
  const pwFile = path.join(os.tmpdir(), `cepheus-pw-${process.pid}-${Date.now()}`);
  writeFileSync(pwFile, `${password}\n`, { encoding: "utf8" });

  try {
    runCommand(
      bins.initdb,
      [
        "-D",
        dataDir,
        "-U",
        user,
        "-A",
        "scram-sha-256",
        `--pwfile=${pwFile}`,
        "-E",
        "UTF8",
        "--locale=C",
      ],
      { timeout: 120_000 }
    );
    return "initialised";
  } finally {
    rmSync(pwFile, { force: true });
  }
}

/**
 * Starts the local database. Starting an already running database is not an error.
 */
export async function startDb(options = {}) {
  const bins = options.bins ?? (await getPlatformBins());
  const dataDir = path.resolve(options.dataDir ?? process.env.DEV_DB_DIR ?? ".pgdata");
  const port = resolvePort(options.port);
  const logFile =
    options.logFile ?? path.join(path.dirname(dataDir), `${path.basename(dataDir)}.log`);

  if (!existsSync(path.join(dataDir, "PG_VERSION"))) {
    await initDb({ bins, dataDir, user: options.user, password: options.password });
  }

  const currentStatus = await getStatus({ bins, dataDir });
  if (currentStatus === "running") {
    return "already_running";
  }

  // pg_ctl detaches the server; on Windows stdio MUST be "ignore" or handles stay open indefinitely.
  execFileSync(
    bins.pg_ctl,
    [
      "start",
      "-D",
      dataDir,
      "-l",
      logFile,
      "-w",
      "-t",
      "40",
      "-o",
      `-p ${port} -c listen_addresses=localhost`,
    ],
    { stdio: "ignore", timeout: 60_000 }
  );

  const afterStatus = await getStatus({ bins, dataDir });
  if (afterStatus !== "running") {
    throw new Error(
      `Failed to start database on port ${port}. Status: ${afterStatus}. Check log file: ${logFile}`
    );
  }

  return "started";
}

/**
 * Stops the local database. Deletes nothing in the data folder.
 */
export async function stopDb(options = {}) {
  const bins = options.bins ?? (await getPlatformBins());
  const dataDir = path.resolve(options.dataDir ?? process.env.DEV_DB_DIR ?? ".pgdata");

  const currentStatus = await getStatus({ bins, dataDir });
  if (currentStatus !== "running") {
    return "already_stopped";
  }

  runCommand(bins.pg_ctl, ["stop", "-D", dataDir, "-m", "fast", "-w", "-t", "40"], {
    timeout: 60_000,
  });

  const afterStatus = await getStatus({ bins, dataDir });
  if (afterStatus !== "stopped") {
    throw new Error(`Failed to stop database cleanly. Status: ${afterStatus}`);
  }

  return "stopped";
}

// CLI handler
const isMain =
  typeof process !== "undefined" &&
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const command = process.argv[2] ?? "status";
  const explicitPort = process.argv[3];

  try {
    if (command === "start") {
      const result = await startDb({ port: explicitPort });
      const currentPort = resolvePort(explicitPort);
      if (result === "already_running") {
        console.log(`Database is already running on port ${currentPort}.`);
      } else {
        console.log(`Database started on port ${currentPort}.`);
      }
    } else if (command === "stop") {
      const result = await stopDb();
      if (result === "already_stopped") {
        console.log("Database is already stopped.");
      } else {
        console.log("Database stopped.");
      }
    } else if (command === "status") {
      const currentStatus = await getStatus();
      console.log(`Database status: ${currentStatus}`);
    } else {
      console.error(`Unknown command: "${command}". Available commands: start, stop, status.`);
      process.exit(1);
    }
  } catch (error) {
    console.error("Database command error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

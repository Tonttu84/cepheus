import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { startDb, stopDb } from "../../../scripts/dev-db.mjs";

let testDataDir: string | undefined;
let testLogFile: string | undefined;

export async function setup() {
  const testPort = process.env.TEST_DB_PORT ?? "54333";
  testDataDir = path.join(os.tmpdir(), `cepheus-dbtest-${Date.now()}-${process.pid}`);
  testLogFile = path.join(os.tmpdir(), `cepheus-dbtest-${Date.now()}-${process.pid}.log`);

  const testDbUrl = `postgresql://cepheus:cepheus-local-only@localhost:${testPort}/cepheus_test`;
  process.env.DATABASE_URL = testDbUrl;

  try {
    console.log(`[test:db] Starting test PostgreSQL database on port ${testPort}...`);
    await startDb({
      port: testPort,
      dataDir: testDataDir,
      logFile: testLogFile,
    });

    console.log("[test:db] Pushing Prisma schema to test database...");
    const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
    execFileSync(
      npxCmd,
      ["prisma", "db", "push", "--skip-generate", "--accept-data-loss"],
      {
        stdio: "pipe",
        timeout: 60_000,
        shell: process.platform === "win32",
        env: {
          ...process.env,
          DATABASE_URL: testDbUrl,
        },
      }
    );
    console.log("[test:db] Test database initialized and schema pushed.");

    return async () => {
      await teardown();
    };
  } catch (err) {
    console.error("[test:db] Setup failed, stopping and cleaning up test database...");
    await teardown();
    throw err;
  }
}

export async function teardown() {
  if (testDataDir) {
    console.log("[test:db] Stopping test database...");
    try {
      await stopDb({ dataDir: testDataDir });
    } catch (err) {
      console.warn("[test:db] Error stopping test database:", err);
    }

    try {
      if (existsSync(testDataDir)) {
        rmSync(testDataDir, { recursive: true, force: true });
      }
    } catch (err) {
      console.warn("[test:db] Error cleaning up temporary data directory:", err);
    }
  }

  if (testLogFile && existsSync(testLogFile)) {
    try {
      rmSync(testLogFile, { force: true });
    } catch {
      // Ignore log removal errors
    }
  }
}

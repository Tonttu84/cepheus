import fs from "node:fs";
import { defineConfig, devices } from "@playwright/test";

function resolveChromiumLaunchOptions() {
  const envExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  if (envExecutable && fs.existsSync(envExecutable)) {
    return {
      executablePath: envExecutable,
      args: ["--no-sandbox", "--disable-gpu"],
    };
  }
  if (fs.existsSync("/usr/bin/brave")) {
    return {
      executablePath: "/usr/bin/brave",
      args: ["--no-sandbox", "--disable-gpu"],
    };
  }
  return undefined;
}

const customLaunchOptions = resolveChromiumLaunchOptions();

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(customLaunchOptions ? { launchOptions: customLaunchOptions } : {}),
      },
    },
  ],
  webServer: {
    command: "node scripts/dev-db.mjs start && npx tsx prisma/seed.ts && npx next dev --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

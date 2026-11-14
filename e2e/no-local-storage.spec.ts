import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { signInAsPatient } from "./helpers";

/**
 * Case 1 (D45): nothing is kept on the person's device. After the real
 * check-in controls are used, the browser holds no web storage, no IndexedDB
 * database and no cookie carrying an answer.
 */
async function expectNothingKeptOnDevice(page: Page, context: BrowserContext) {
  const storage = await page.evaluate(() => ({
    local: Object.keys(window.localStorage),
    session: Object.keys(window.sessionStorage),
  }));
  expect(storage.local).toEqual([]);
  expect(storage.session).toEqual([]);

  const databases = await page.evaluate(async () =>
    (await indexedDB.databases()).map((db) => db.name ?? "")
  );
  expect(databases).toEqual([]);

  const answerCookies = (await context.cookies()).filter((c) =>
    /mood|interest|answer|phq|check.?in|not.?today|skip/i.test(`${c.name}=${c.value}`)
  );
  expect(answerCookies).toEqual([]);
}

test.describe("Case 1: nothing is kept on the device", () => {
  test("answering both check-in prompts leaves no browser storage", async ({ page, context }) => {
    await signInAsPatient(page, context);
    await page.goto("/check-in");

    const mood = page.getByRole("button", { name: "Mood: 3 of 4" });
    const interest = page.getByRole("button", { name: "Interest: 1 of 4" });
    await mood.click();
    await interest.click();
    await expect(mood).toHaveAttribute("aria-pressed", "true");
    await expect(interest).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("status")).toContainText("All 2 answers selected");

    await expectNothingKeptOnDevice(page, context);
  });

  test("tapping Not today leaves no browser storage", async ({ page, context }) => {
    await signInAsPatient(page, context);
    await page.goto("/check-in");

    await page.getByTestId("not-today-button").click();
    await expect(page.getByRole("status")).toContainText("Taking a day off");

    await expectNothingKeptOnDevice(page, context);
  });
});

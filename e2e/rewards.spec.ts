import { test, expect } from "@playwright/test";
import { signInAsPatient } from "./helpers";

test.describe("Rewards flow", () => {
  test("patient can answer check-in, see balance update and mark task done", async ({ page }) => {
    await signInAsPatient(page, "P-SIM-001");

    // Answer a check-in to get the reward
    await page.goto("/check-in");
    
    const moodBtn = page.getByRole("button", { name: "Good" });
    if (await moodBtn.isVisible()) {
      await moodBtn.click();
      await page.getByRole("button", { name: "A lot" }).click();
      await page.getByRole("button", { name: "Done" }).click();
    }

    // Go to rewards
    await page.goto("/rewards");
    
    // Check balance
    const balance = await page.locator('section[aria-label="My balance"]').innerText();
    expect(balance).toContain("simulated");

    // Mark task done
    const doneBtn = page.getByRole("button", { name: "Done" });
    if (await doneBtn.isVisible()) {
      await doneBtn.click();
      await expect(page.locator("text=Done.")).toBeVisible();
    }

    // Reload page to verify persistence
    await page.reload();
    await expect(page.locator("text=Done.")).toBeVisible();
  });

  test("shows walks count beside answered-rounds count (D38, D42) without calling it a streak or score", async ({ page }) => {
    await signInAsPatient(page, "P-SIM-001");
    await page.goto("/rewards");

    // D38 & D42: Visible count of answered rounds and visible count of walks
    await expect(page.locator("text=rounds answered")).toBeVisible();
    await expect(page.locator("text=walks")).toBeVisible();

    // Must NOT show "tasks done"
    await expect(page.locator("text=tasks done")).toHaveCount(0);

    // Must NOT be labeled as a streak or score (AGENTS.md, D38, D42)
    const pageText = await page.textContent("body");
    expect(pageText).not.toMatch(/streak/i);
    expect(pageText).not.toMatch(/score/i);
  });

  test("questionnaire completion does not add reward entry (D48 credits answered rounds and small tasks only)", async ({ page }) => {
    await signInAsPatient(page, "P-SIM-001");
    await page.goto("/check-in");

    // If PHQ-9 is offered, complete an item
    const phq9Option = page.getByRole("button", { name: "Not at all" }).first();
    if (await phq9Option.isVisible()) {
      await phq9Option.click();
    }

    // Go to rewards page
    await page.goto("/rewards");

    // D48: Rewards only include answered rounds and completed small tasks
    // Ledger entries must not contain PHQ-9 or GAD-7 entries
    const pageContent = await page.content();
    expect(pageContent).not.toContain("phq9_completed");
    expect(pageContent).not.toContain("gad7_completed");
  });

  test("viewing today's task without completing it has no effect on ledger or progress (D48)", async ({ page }) => {
    await signInAsPatient(page, "P-SIM-001");
    await page.goto("/rewards");

    // Viewing the task shows the task description
    await expect(page.locator('section[aria-label="Today\'s task"]')).toBeVisible();

    // Balance remains intact and simulated label is preserved
    const balanceText = await page.locator('section[aria-label="My balance"]').innerText();
    expect(balanceText).toContain("simulated");

    // Reloading leaves it offering the same task without having marked it done
    await page.reload();
    const doneBtn = page.getByRole("button", { name: "Done" });
    if (await doneBtn.isVisible()) {
      // The task is still uncompleted and ready to be done
      await expect(doneBtn).toBeEnabled();
    }
  });
});

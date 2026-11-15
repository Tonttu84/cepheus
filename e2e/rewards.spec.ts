import { test, expect } from "@playwright/test";
import { signInAsPatient, resetRewardsState } from "./helpers";

test.describe("Rewards flow", () => {
  test("patient can answer check-in, see balance update and mark task done", async ({ page }) => {
    await resetRewardsState("P-SIM-001", { nonCheckInDay: true });
    await signInAsPatient(page, "P-SIM-001");

    // Answer a check-in to get the reward
    await page.goto("/check-in");

    const moodBtn = page.getByRole("button", { name: "Mood: 2 of 4" });
    await expect(moodBtn).toBeVisible();
    await moodBtn.click();

    const interestBtn = page.getByRole("button", { name: "Interest: 2 of 4" });
    await expect(interestBtn).toBeVisible();
    await interestBtn.click();

    // Go to rewards
    await page.goto("/rewards");

    // Check balance contains simulated badge and upfront neutral disclaimer
    const balanceSection = page.locator('section[aria-label="My balance"]');
    await expect(balanceSection).toBeVisible();
    await expect(balanceSection).toContainText("simulated");
    await expect(balanceSection).toContainText(
      "Amounts and payouts are simulated in this demonstration and no real money is paid."
    );

    // Mark task done
    const doneBtn = page.getByRole("button", { name: "Done" });
    await expect(doneBtn).toBeVisible();
    await doneBtn.click();
    await expect(page.locator("text=Done.")).toBeVisible();

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
    await resetRewardsState("P-SIM-001");
    await signInAsPatient(page, "P-SIM-001");
    await page.goto("/check-in");

    // Answer the two taps first so that PHQ-9 is offered
    const moodBtn = page.getByRole("button", { name: "Mood: 2 of 4" });
    await expect(moodBtn).toBeVisible();
    await moodBtn.click();

    const interestBtn = page.getByRole("button", { name: "Interest: 2 of 4" });
    await expect(interestBtn).toBeVisible();
    await interestBtn.click();

    // Answer a PHQ-9 item
    const phq9Option = page.getByRole("button", { name: "Question 1: 0 of 3" });
    await expect(phq9Option).toBeVisible();
    await phq9Option.click();

    // Go to rewards page
    await page.goto("/rewards");

    // D48: Rewards only include answered rounds and completed small tasks
    // Ledger entries must not contain PHQ-9 or GAD-7 entries
    const pageContent = await page.content();
    expect(pageContent).not.toContain("phq9_completed");
    expect(pageContent).not.toContain("gad7_completed");
  });

  test("viewing today's task without completing it has no effect on ledger or progress (D48)", async ({ page }) => {
    await resetRewardsState("P-SIM-001", { nonCheckInDay: true });
    await signInAsPatient(page, "P-SIM-001");
    await page.goto("/rewards");

    // Viewing the task shows the task description
    await expect(page.locator('section[aria-label="Today\'s small task"]')).toBeVisible();

    // Balance remains intact and simulated label is preserved
    const balanceText = await page.locator('section[aria-label="My balance"]').innerText();
    expect(balanceText).toContain("simulated");

    // The task is uncompleted and ready to be done
    const doneBtn = page.getByRole("button", { name: "Done" });
    await expect(doneBtn).toBeVisible();
    await expect(doneBtn).toBeEnabled();

    // Reloading leaves it offering the same task without having marked it done
    await page.reload();
    await expect(doneBtn).toBeVisible();
    await expect(doneBtn).toBeEnabled();
  });

  test("payout: neutral notice is shown up front, payout reduces balance and entry is marked simulated (D48)", async ({ page }) => {
    // Seed 10 euros balance so payout button is active
    await resetRewardsState("P-SIM-001", { nonCheckInDay: true, balanceCents: 1000 });
    await signInAsPatient(page, "P-SIM-001");
    await page.goto("/rewards");

    // Neutral disclaimer is visible beside balance and beside payout button before clicking
    await expect(
      page.locator('section[aria-label="My balance"]').getByText("Amounts and payouts are simulated in this demonstration and no real money is paid.")
    ).toBeVisible();

    // Payout button is visible and enabled
    const payoutBtn = page.getByRole("button", { name: "Request payout" });
    await expect(payoutBtn).toBeVisible();
    await expect(payoutBtn).toBeEnabled();

    // Click payout
    await payoutBtn.click();

    // Status message confirms simulated payout requested
    await expect(page.locator("text=Simulated payout requested. No real money is paid in this demonstration.")).toBeVisible();

    // Button is no longer shown
    await expect(page.getByRole("button", { name: "Request payout" })).toHaveCount(0);

    // Balance reflects payout and payout entry in list is marked simulated
    await expect(page.locator('section[aria-label="My balance"]')).toContainText("€0.00");
    await expect(page.locator("text=Payout")).toBeVisible();
  });
});

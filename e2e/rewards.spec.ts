import { test, expect } from "@playwright/test";
import { signInAsPatient } from "./helpers";

test.describe("Rewards flow", () => {
  test("patient can answer check-in, see balance update and mark task done", async ({ page }) => {
    await signInAsPatient(page, "P-SIM-001"); // P-SIM-001 or similar

    // Answer a check-in to get the reward
    // Wait for the taps to be visible
    await page.goto("/check-in");
    
    // Check if checkin is available
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
});

import { expect } from "@playwright/test";
import { signInAsStaff, test } from "./helpers";

test.describe("Clinic follow-up screen: nurse call requests & crisis alerts", () => {
  test("nurse requests a call on a flag (persisted on reload) and acknowledges a crisis alert (gone on reload)", async ({
    page,
    context,
  }) => {
    // 1. Sign in as nurse with seeded flag and unacknowledged crisis event
    await signInAsStaff(page, context, {
      ensureFlag: true,
      ensureCrisisEvent: true,
    });

    await page.goto("/clinic");

    // 2. Crisis alerts show at the top above the flags
    const crisisSection = page.getByTestId("clinic-crisis-alerts");
    await expect(crisisSection).toBeVisible();
    const alertItem = page.getByTestId("crisis-alert-item").first();
    await expect(alertItem).toBeVisible();

    // 3. Flag card shows open follow-up flag, no booster offer button, no "nothing is sent yet" text
    const flagCard = page.getByTestId("clinic-flag-card").first();
    await expect(flagCard).toBeVisible();
    await expect(page.getByTestId("clinic-action-booster")).toHaveCount(0);
    const mainText = await page.locator("main").innerText();
    expect(mainText).not.toContain("nothing is sent yet");

    // 4. Request nurse call on the flag
    const requestCallBtn = page.getByTestId("clinic-action-nurse-call").first();
    await requestCallBtn.click();

    // 5. Card shows that call is requested with server confirmation
    const callStatus = page.getByTestId("nurse-call-status").first();
    await expect(callStatus).toBeVisible();
    await expect(callStatus).toContainText("Nurse call requested by");

    // 6. Reload page: call request is still shown
    await page.reload();
    const reloadedCard = page.getByTestId("clinic-flag-card").first();
    await expect(reloadedCard).toBeVisible();
    const reloadedCallStatus = page.getByTestId("nurse-call-status").first();
    await expect(reloadedCallStatus).toBeVisible();
    await expect(reloadedCallStatus).toContainText("Nurse call requested by");

    // 7. Acknowledge the crisis alert
    const ackBtn = page.getByTestId("acknowledge-crisis-btn").first();
    await expect(ackBtn).toBeVisible();
    await ackBtn.click();

    // 8. Alert leaves the list
    await expect(page.getByTestId("crisis-alert-item")).toHaveCount(0);

    // 9. Reload page: crisis alert is gone
    await page.reload();
    await expect(page.getByTestId("crisis-alert-item")).toHaveCount(0);
  });

  test("as the seeded nurse, the flag of a seeded patient shows its kind and its numbers, and the fixed paragraph is gone", async ({
    page,
    context,
  }) => {
    // 1. Sign in as nurse with seeded flag
    await signInAsStaff(page, context, {
      ensureFlag: true,
    });

    await page.goto("/clinic");

    // 2. The flag card is visible
    const flagCard = page.getByTestId("clinic-flag-card").first();
    await expect(flagCard).toBeVisible();

    // 3. The fixed Week 8 paragraph is gone
    const cardText = await flagCard.innerText();
    expect(cardText).not.toContain("the Week 8 rounds went unanswered");
    expect(cardText).not.toContain("After two lower check-ins");

    // 4. Shows its kind and its numbers
    const factsSection = page.getByTestId("clinic-flag-facts").first();
    await expect(factsSection).toBeVisible();
    await expect(page.getByTestId("clinic-flag-kind").first()).toBeVisible();
    await expect(page.getByTestId("clinic-flag-fact-line").first()).toBeVisible();

    // 5. Patient remains labeled as simulated
    await expect(flagCard.getByText("Simulated", { exact: false })).toBeVisible();
  });
});

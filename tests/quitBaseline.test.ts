import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { baselineLine, quantityText, quitDaySummary, singularUnit, targetLine, unitFor } from "../lib/quitBaseline";
import { quitHabit, localNoon } from "./helpers/fixtures";

const rs = (amount: number) => `Rs ${amount}`;

describe("unit wording", () => {
  test("singular and plural follow the count", () => {
    assert.equal(quantityText(1, "sticks"), "1 stick");
    assert.equal(quantityText(0, "sticks"), "0 sticks");
    assert.equal(quantityText(4, "sticks"), "4 sticks");
    assert.equal(quantityText(0.5, "sticks"), "0.5 sticks");
    assert.equal(quantityText(1, "minutes"), "1 minute");
    assert.equal(quantityText(60, "minutes"), "60 minutes");
  });

  test("works whether the stored unit was typed singular or plural", () => {
    assert.equal(unitFor("puff", 1), "puff");
    assert.equal(unitFor("puff", 4), "puffs");
    assert.equal(unitFor("puffs", 1), "puff");
    assert.equal(unitFor("glass", 3), "glasses");
    assert.equal(unitFor("glasses", 1), "glass");
    assert.equal(unitFor("pouches", 1), "pouch");
    assert.equal(unitFor("pouch", 2), "pouches");
    assert.equal(unitFor("berries", 1), "berry");
    assert.equal(unitFor("berry", 2), "berries");
    assert.equal(unitFor(null, 3), "units");
    assert.equal(singularUnit("sticks"), "stick");
  });
});

describe("baseline and target lines", () => {
  test("the stored baseline is shown as it was set up", () => {
    assert.equal(baselineLine(quitHabit({ baselineQuantity: 4 })), "Baseline: 4 sticks/day");
    assert.equal(baselineLine(quitHabit({ baselineQuantity: 1 })), "Baseline: 1 stick/day");
  });

  test("no baseline line when none is stored (never worked out from anything else)", () => {
    assert.equal(baselineLine(quitHabit({ baselineQuantity: null })), null);
    assert.equal(baselineLine(quitHabit({ baselineQuantity: 0 })), null);
    assert.equal(targetLine(quitHabit({ baselineQuantity: null }), "2026-09-19"), null);
  });

  test("today's target by goal type", () => {
    const created = localNoon("2026-09-19"); // day 1 of the cycle: the target equals the baseline
    assert.equal(
      targetLine(quitHabit({ goalType: "reduce", reduceDays: 14, createdAt: created }), "2026-09-19"),
      "Today's target: 4 sticks or fewer"
    );
    assert.equal(
      targetLine(quitHabit({ goalType: "quit_completely" }), "2026-09-19"),
      "Today's target: 0 sticks"
    );
    assert.equal(targetLine(quitHabit({ goalType: "track_only" }), "2026-09-19"), null);

    // The target declines through the cycle; the baseline line does not.
    const later = quitHabit({ goalType: "reduce", reduceDays: 14, createdAt: localNoon("2026-09-13") });
    assert.equal(targetLine(later, "2026-09-19"), "Today's target: 2 sticks or fewer");
    assert.equal(baselineLine(later), "Baseline: 4 sticks/day");
  });
});

describe("today's spending card", () => {
  test("baseline 4 x Rs 25 with 3 logged", () => {
    const summary = quitDaySummary(quitHabit(), 3, true, rs)!;
    assert.equal(summary.consumptionText, "3 sticks today");
    assert.equal(summary.spendingText, "3 × Rs 25 = Rs 75 spent");
    assert.equal(summary.differenceText, "1 stick below your baseline");
    assert.equal(summary.savedText, "Rs 25 saved today");
  });

  test("at, above and far above the baseline", () => {
    const at = quitDaySummary(quitHabit(), 4, true, rs)!;
    assert.equal(at.differenceText, "Exactly at your baseline");
    assert.equal(at.savedText, "Rs 0 saved today");

    const above = quitDaySummary(quitHabit(), 6, true, rs)!;
    assert.equal(above.spendingText, "6 × Rs 25 = Rs 150 spent");
    assert.equal(above.differenceText, "2 sticks above your baseline");
    assert.equal(above.savedText, "Rs 0 saved today", "the excess is spending, never a negative saving");
  });

  test("a clean day", () => {
    const clean = quitDaySummary(quitHabit(), 0, true, rs)!;
    assert.equal(clean.consumptionText, "0 sticks today");
    assert.equal(clean.spendingText, "0 × Rs 25 = Rs 0 spent");
    assert.equal(clean.differenceText, "4 sticks below your baseline");
    assert.equal(clean.savedText, "Rs 100 saved today");
  });

  test("a day nobody logged claims nothing", () => {
    const unknown = quitDaySummary(quitHabit(), 0, false, rs)!;
    assert.equal(unknown.logged, false);
    assert.equal(unknown.spendingText, null);
    assert.equal(unknown.differenceText, null);
    assert.match(unknown.savedText, /No saving is counted/);
  });

  test("uses the original baseline even when today's target has come down to 0", () => {
    const nearlyQuit = quitHabit({ goalType: "reduce", reduceDays: 14, createdAt: localNoon("2026-09-01") });
    const summary = quitDaySummary(nearlyQuit, 1, true, rs)!;
    assert.equal(summary.differenceText, "3 sticks below your baseline");
    assert.equal(summary.savedText, "Rs 75 saved today");
  });

  test("nothing to show without a stored baseline", () => {
    assert.equal(quitDaySummary(quitHabit({ baselineQuantity: null }), 2, true, rs), null);
  });
});

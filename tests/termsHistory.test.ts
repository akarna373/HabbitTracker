import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { addDays, last7Days } from "../lib/dates";
import {
  baselineCost,
  costForAmount,
  estimatedSavingsThisWeek,
  isHabitCompleteOn,
  reduceDailyTargetForDate,
  totalCostThisWeek,
} from "../lib/progress";
import { sortedHistory, termsOn } from "../lib/termsHistory";
import type { TermsEntry } from "../lib/types";
import { localNoon, log, quitHabit } from "./helpers/fixtures";

const entry = (effectiveFrom: string, baselineQuantity: number | null, pricePerItem: number | null): TermsEntry => ({
  effectiveFrom,
  baselineQuantity,
  pricePerItem,
});

describe("termsOn", () => {
  const history = [entry("2026-09-01", 4, 25), entry("2026-09-15", 4, 30), entry("2026-10-01", 3, 35)];
  const habit = { baselineQuantity: 3, pricePerItem: 35, termsHistory: history };

  test("the entry in force on the day", () => {
    assert.deepEqual(termsOn(habit, "2026-09-10"), { baselineQuantity: 4, pricePerItem: 25 });
    assert.deepEqual(termsOn(habit, "2026-09-20"), { baselineQuantity: 4, pricePerItem: 30 });
    assert.deepEqual(termsOn(habit, "2026-12-31"), { baselineQuantity: 3, pricePerItem: 35 });
  });

  test("a change starts ON its date, not the day after", () => {
    assert.equal(termsOn(habit, "2026-09-14").pricePerItem, 25);
    assert.equal(termsOn(habit, "2026-09-15").pricePerItem, 30);
    assert.equal(termsOn(habit, "2026-10-01").pricePerItem, 35);
  });

  test("a day before the first entry gets the terms the habit began with", () => {
    assert.equal(termsOn(habit, "2026-08-01").pricePerItem, 25);
  });

  test("no history means the values on the habit", () => {
    assert.deepEqual(termsOn({ baselineQuantity: 5, pricePerItem: 20 }, "2026-09-10"), { baselineQuantity: 5, pricePerItem: 20 });
    assert.deepEqual(termsOn({ baselineQuantity: 5, pricePerItem: 20, termsHistory: [] }, "2026-09-10"), {
      baselineQuantity: 5,
      pricePerItem: 20,
    });
  });

  test("entry order does not matter", () => {
    const shuffled = { ...habit, termsHistory: [history[2], history[0], history[1]] };
    assert.equal(termsOn(shuffled, "2026-09-20").pricePerItem, 30);
    assert.equal(termsOn(shuffled, "2026-08-01").pricePerItem, 25);
    assert.deepEqual(sortedHistory(shuffled.termsHistory).map((e) => e.effectiveFrom), ["2026-09-01", "2026-09-15", "2026-10-01"]);
  });
});

describe("a price change never reaches a past day (the screens that estimate from the logs)", () => {
  // The price was Rs 25 until 4 days ago and Rs 30 since. Days are relative to the real today
  // so the "last 7 days" the app looks at line up.
  const days = last7Days(); // oldest -> newest
  const changeDay = days[3];
  const habit = quitHabit({
    baselineQuantity: 4,
    pricePerItem: 30,
    goalType: "track_only",
    termsHistory: [entry(days[0], 4, 25), entry(changeDay, 4, 30)],
  });

  test("cost and baseline cost are those of the day asked about", () => {
    assert.equal(costForAmount(habit, 2, days[1]), 50);
    assert.equal(costForAmount(habit, 2, days[5]), 60);
    assert.equal(baselineCost(habit, days[1]), 100);
    assert.equal(baselineCost(habit, days[5]), 120);
  });

  test("the weekly savings estimate prices each day with its own terms", () => {
    // One cigarette a day for the whole week: saved (4 - 1) x price each day.
    const logs = days.map((day) => log(day, 1));
    // 3 days at Rs 25 (75 each) + 4 days at Rs 30 (90 each) = 225 + 360.
    assert.equal(estimatedSavingsThisWeek(habit, logs), 3 * 75 + 4 * 90);
    // Pricing every day at today's Rs 30 would have given 7 x 90 = 630: the old, wrong result.
    assert.notEqual(estimatedSavingsThisWeek(habit, logs), 7 * 90);
  });

  test("the weekly cost total prices each day with its own price", () => {
    const logs = days.map((day) => log(day, 2));
    assert.equal(totalCostThisWeek(habit, logs), 3 * 50 + 4 * 60);
  });

  test("with no history everything behaves as before", () => {
    const plain = quitHabit({ baselineQuantity: 4, pricePerItem: 30, termsHistory: undefined });
    const logs = days.map((day) => log(day, 1));
    assert.equal(estimatedSavingsThisWeek(plain, logs), 7 * 90);
  });
});

describe("a baseline change never rewrites past targets or streaks", () => {
  // Reduce over 14 days from 12 days ago.
  const start = addDays(last7Days()[6], -12);
  const created = localNoon(start);
  const day = (n: number) => addDays(start, n);
  const changeOn = day(6);
  const reducing = quitHabit({
    goalType: "reduce",
    reduceDays: 14,
    createdAt: created,
    baselineQuantity: 20,
    termsHistory: [entry(start, 10, 25), entry(changeOn, 20, 25)],
  });
  const untouched = quitHabit({
    goalType: "reduce",
    reduceDays: 14,
    createdAt: created,
    baselineQuantity: 10,
    termsHistory: [entry(start, 10, 25)],
  });

  test("days before the change keep their target", () => {
    for (let n = 0; n < 6; n++) {
      assert.equal(reduceDailyTargetForDate(reducing, day(n)), reduceDailyTargetForDate(untouched, day(n)), `day ${n}`);
    }
  });

  test("days from the change use the new baseline", () => {
    assert.ok(reduceDailyTargetForDate(reducing, day(7)) > reduceDailyTargetForDate(untouched, day(7)));
  });

  test("a day that was completed stays completed after the baseline is raised", () => {
    // 5 cigarettes on day 2: at the old baseline of 10 the target that day is 8, so it was a pass.
    const logs = [log(day(2), 5)];
    assert.equal(isHabitCompleteOn(untouched, logs, day(2)), true);
    assert.equal(isHabitCompleteOn(reducing, logs, day(2)), true);
    // ...and a day that missed its target does not become a pass later.
    const missed = [log(day(2), 9)];
    assert.equal(isHabitCompleteOn(untouched, missed, day(2)), false);
    assert.equal(isHabitCompleteOn(reducing, missed, day(2)), false);
  });
});

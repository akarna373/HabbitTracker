import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { last7Days } from "../lib/dates";
import { estimatedSavingsThisWeek, smokeFreeDaysThisWeek } from "../lib/progress";
import { log, quitHabit } from "./helpers/fixtures";

// The weekly figures on the Progress tab, "Motivate me" and the habit summary follow the same rule
// as the dashboard: a day counts only if its amount was recorded on purpose.
describe("weekly figures ignore placeholder rows", () => {
  const days = last7Days(); // oldest -> newest
  const habit = quitHabit({ baselineQuantity: 4, pricePerItem: 25, goalType: "track_only" });
  // What saving a reflection or ticking a microtask leaves behind on a day with no count.
  const placeholder = (date: string) => log(date, 0, { amountLogged: false, reflection: "a hard evening" });

  test("a reflection-only day is not a saving", () => {
    const logs = [log(days[5], 1), placeholder(days[6])];
    assert.equal(estimatedSavingsThisWeek(habit, logs), 75, "only the real day (4 - 1) x 25 counts");
  });

  test("a reflection-only day is not a smoke-free day", () => {
    const logs = [log(days[4], 0), placeholder(days[5]), log(days[6], 2)];
    assert.equal(smokeFreeDaysThisWeek(habit, logs), 1, "only the day logged as 0 on purpose");
  });

  test("an explicit zero still counts as a clean, saving day", () => {
    const logs = [log(days[6], 0)];
    assert.equal(smokeFreeDaysThisWeek(habit, logs), 1);
    assert.equal(estimatedSavingsThisWeek(habit, logs), 100);
  });

  test("a placeholder that later gets a real count counts (the row is updated in place)", () => {
    const logs = [log(days[6], 3, { reflection: "slipped once" })];
    assert.equal(estimatedSavingsThisWeek(habit, logs), 25);
  });

  test("a week of only placeholders shows nothing", () => {
    const logs = days.map(placeholder);
    assert.equal(estimatedSavingsThisWeek(habit, logs), 0);
    assert.equal(smokeFreeDaysThisWeek(habit, logs), 0);
  });
});

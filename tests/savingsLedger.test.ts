import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { computeFinancialSummary } from "../lib/financialSummary";
import { monthRangeFor } from "../lib/monthRange";
import {
  applyLedgerPlan,
  computeAmounts,
  getSavingsTerms,
  needsBaseline,
  planLedgerSync,
  sumLedger,
  toMinor,
  type LedgerRow,
} from "../lib/savingsLedger";
import type { DailyLog } from "../lib/types";
import { BASELINE, log, quitHabit, localNoon } from "./helpers/fixtures";

const TODAY = "2026-09-19";

function summaryOf(habitLogs: DailyLog[], overrides: Partial<Parameters<typeof computeFinancialSummary>[0]> = {}) {
  return computeFinancialSummary({
    habits: [quitHabit()],
    logsByHabit: { smoke: habitLogs },
    ledger: [],
    today: TODAY,
    calendarType: "gregorian",
    ...overrides,
  });
}

describe("potential savings remaining today (live)", () => {
  test("baseline 4 x Rs 25 with 0 through 5 logged", () => {
    const remaining = [0, 1, 2, 3, 4, 5].map(
      (count) => summaryOf([log(TODAY, count)]).potentialSavingsRemainingToday
    );
    assert.deepEqual(remaining, [100, 75, 50, 25, 0, 0]);

    const spent = [0, 1, 2, 3, 4, 5].map((count) => summaryOf([log(TODAY, count)]).spentToday);
    assert.deepEqual(spent, [0, 25, 50, 75, 100, 125]);
  });

  test("shows the full baseline cost before anything is logged", () => {
    assert.equal(summaryOf([]).potentialSavingsRemainingToday, 100);
  });

  test("never goes negative, however much is logged", () => {
    const summary = summaryOf([log(TODAY, 40)]);
    assert.equal(summary.potentialSavingsRemainingToday, 0);
    assert.equal(summary.savedToday, 0);
    assert.equal(summary.spentToday, 1000); // the excess still counts as spending
  });

  test("sums every eligible quit habit", () => {
    const alcohol = quitHabit({ id: "alc", name: "Alcohol", baselineQuantity: 2, pricePerItem: 100 });
    const both = (smoked: number, drank: number) =>
      computeFinancialSummary({
        habits: [quitHabit(), alcohol],
        logsByHabit: {
          smoke: [log(TODAY, smoked)],
          alc: [log(TODAY, drank, { habitId: "alc", id: "alc-log" })],
        },
        ledger: [],
        today: TODAY,
        calendarType: "gregorian",
      });

    assert.equal(both(0, 0).potentialSavingsRemainingToday, 300); // 100 + 200
    assert.equal(both(1, 0).potentialSavingsRemainingToday, 275);
    assert.equal(both(1, 1).potentialSavingsRemainingToday, 175); // 75 + 100
    assert.equal(both(9, 9).potentialSavingsRemainingToday, 0);
  });

  test("Rs 305 drops to Rs 280 the moment one Rs 25 cigarette is logged", () => {
    const other = quitHabit({ id: "other", name: "Other", baselineQuantity: 41, pricePerItem: 5 }); // Rs 205
    const at = (smoked: number) =>
      computeFinancialSummary({
        habits: [quitHabit(), other],
        logsByHabit: { smoke: smoked === 0 ? [] : [log(TODAY, smoked)] },
        ledger: [],
        today: TODAY,
        calendarType: "gregorian",
      }).potentialSavingsRemainingToday;
    assert.equal(at(0), 305);
    assert.equal(at(1), 280);
  });

  test("a habit that is not scheduled today has nothing to save today", () => {
    const mondayOnly = quitHabit({ repeatDays: [0] }); // 2026-09-19 is a Saturday
    assert.equal(summaryOf([], { habits: [mondayOnly] }).potentialSavingsRemainingToday, 0);
  });

  test("uses the ORIGINAL baseline, not today's reduced target", () => {
    // Reduce goal, day 13 of 14: today's target is about 0, but the baseline is still 4.
    const reducing = quitHabit({ goalType: "reduce", reduceDays: 14, createdAt: localNoon("2026-09-07") });
    assert.equal(summaryOf([log(TODAY, 1)], { habits: [reducing] }).potentialSavingsRemainingToday, 75);
  });
});

describe("what counts as a saving", () => {
  test("no log is unknown: it earns nothing and adds no spending", () => {
    const summary = summaryOf([]);
    assert.equal(summary.savedToday, 0);
    assert.equal(summary.spentToday, 0);
    assert.equal(summary.hasSufficientData, true);
  });

  test("a placeholder row (reflection or ticked microtask) is not a clean day", () => {
    const placeholder = log(TODAY, 0, { amountLogged: false, reflection: "tough day" });
    const summary = summaryOf([placeholder]);
    assert.equal(summary.savedToday, 0);
    assert.equal(summary.spentToday, 0);
    assert.equal(summary.habits[0].hasLogToday, false);

    const plan = planLedgerSync({
      habits: [quitHabit()],
      logsByHabit: { smoke: [placeholder] },
      existing: [],
      today: TODAY,
      nowISO: "2026-09-19T10:00:00.000Z",
    });
    assert.deepEqual(plan, { upserts: [], deletes: [] });
  });

  test("an explicit 0 is a clean day and earns the full baseline cost", () => {
    const summary = summaryOf([log(TODAY, 0)]);
    assert.equal(summary.savedToday, 100);
    assert.equal(summary.habits[0].cleanDaysThisMonth, 1);
  });

  test("today's saving is provisional: it is not in this month's total until the day ends", () => {
    const summary = summaryOf([log(TODAY, 1)]);
    assert.equal(summary.savedToday, 75);
    assert.equal(summary.savedThisMonth, 0);
    assert.equal(summary.spentThisMonth, 25); // spending is a fact, so it is in already
  });
});

describe("finished versus provisional days in a month total", () => {
  test("only final days count as saved; a provisional day is spending only", () => {
    // 17 Sep is final. 18 Sep is still provisional (the first run after midnight has not happened yet).
    const rows = [dayRowFor("2026-09-17"), { ...dayRowFor("2026-09-18"), finalizedAt: null }];

    const totals = sumLedger(rows, { start: "2026-09-01", end: "2026-09-30" });
    assert.equal(totals.savedMinor, 2500, "the provisional day earns nothing yet");
    assert.equal(totals.spentMinor, 15000, "but what was spent is already spent");
    assert.equal(totals.loggedDays, 2);

    const summary = computeFinancialSummary({
      habits: [quitHabit()],
      logsByHabit: {},
      ledger: rows,
      today: "2026-09-19",
      calendarType: "gregorian",
    });
    assert.equal(summary.savedThisMonth, 25);
    assert.equal(summary.spentThisMonth, 150);
  });
});

describe("money in whole minor units", () => {
  test("no floating-point drift", () => {
    assert.equal(toMinor(0.1) * 3, 30);
    assert.equal(toMinor(1.005), 101);
    assert.equal(toMinor(19.99), 1999);
    const amounts = computeAmounts(3, toMinor(0.1), 3);
    assert.deepEqual(amounts, { baselineCostMinor: 30, actualSpendingMinor: 30, savedMinor: 0 });
  });

  test("a free item (price 0) is allowed and saves nothing", () => {
    assert.deepEqual(getSavingsTerms(quitHabit({ pricePerItem: 0 })), { baselineQuantity: BASELINE, unitPriceMinor: 0 });
  });
});

describe("planLedgerSync", () => {
  const NOW = "2026-09-19T10:00:00.000Z";
  const plan = (habitLogs: DailyLog[], existing: LedgerRow[], today: string, nowISO = NOW, habit = quitHabit()) =>
    planLedgerSync({ habits: [habit], logsByHabit: { smoke: habitLogs }, existing, today, nowISO });

  test("day rollover finalizes the day that ended", () => {
    const first = plan([log("2026-09-19", 1)], [], "2026-09-19");
    const rows = applyLedgerPlan([], first);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].finalizedAt, null, "today is provisional");
    assert.equal(rows[0].savedMinor, 7500);

    const later = "2026-09-20T00:05:00.000Z";
    const second = plan([log("2026-09-19", 1)], rows, "2026-09-20", later);
    const finalRows = applyLedgerPlan(rows, second);
    assert.equal(finalRows.length, 1);
    assert.equal(finalRows[0].finalizedAt, later);
    assert.equal(finalRows[0].savedMinor, 7500);
  });

  test("running it again on its own result plans nothing (idempotent)", () => {
    const logs = [log("2026-09-15", 2), log("2026-09-16", 0), log("2026-09-19", 3)];
    const rows = applyLedgerPlan([], plan(logs, [], "2026-09-19"));
    assert.equal(rows.length, 3);

    const again = plan(logs, rows, "2026-09-19", "2026-09-19T11:00:00.000Z");
    assert.deepEqual(again, { upserts: [], deletes: [] });
    assert.equal(applyLedgerPlan(rows, again).length, 3, "no day is ever credited twice");
  });

  test("the app closed across midnight: the next run finalizes every unfinished past day", () => {
    const logs = [log("2026-09-16", 1), log("2026-09-17", 4), log("2026-09-18", 0)];
    // Only the provisional rows exist (written the days they were logged); nothing ran since.
    const provisional = applyLedgerPlan([], plan(logs, [], "2026-09-16", "2026-09-16T20:00:00.000Z"));
    assert.equal(provisional.length, 1);
    assert.equal(provisional[0].finalizedAt, null);

    const woke = "2026-09-21T08:00:00.000Z";
    const rows = applyLedgerPlan(provisional, plan(logs, provisional, "2026-09-21", woke));
    assert.equal(rows.length, 3);
    assert.ok(rows.every((row) => row.finalizedAt !== null), "all three days are final");
    assert.equal(sumLedger(rows, { start: "2026-09-01", end: "2026-09-30" }).savedMinor, 7500 + 0 + 10000);
  });

  test("a day nobody logged gets no record (unknown, not zero)", () => {
    const rows = applyLedgerPlan([], plan([log("2026-09-15", 1), log("2026-09-17", 1)], [], "2026-09-19"));
    assert.deepEqual(rows.map((row) => row.date).sort(), ["2026-09-15", "2026-09-17"]);
  });

  test("editing a finalized older log recomputes that day instead of adding to it", () => {
    const original = applyLedgerPlan([], plan([log("2026-09-10", 1)], [], "2026-09-19"));
    assert.equal(original[0].savedMinor, 7500);
    const totalBefore = sumLedger(original, { start: "2026-09-01", end: "2026-09-30" });
    assert.equal(totalBefore.savedMinor, 7500);

    // The person corrects it: they actually had 3.
    const edited = applyLedgerPlan(original, plan([log("2026-09-10", 3)], original, "2026-09-19", localNoon("2026-09-19")));
    assert.equal(edited.length, 1);
    assert.equal(edited[0].actualQuantity, 3);
    assert.equal(edited[0].savedMinor, 2500);
    assert.equal(edited[0].finalizedAt, original[0].finalizedAt, "stays final");
    assert.equal(sumLedger(edited, { start: "2026-09-01", end: "2026-09-30" }).savedMinor, 2500);

    // Deleting the log removes the record: the day becomes unknown again.
    const removed = applyLedgerPlan(edited, plan([], edited, "2026-09-19"));
    assert.equal(removed.length, 0);
  });

  test("a later price or baseline change affects future days only", () => {
    const rows = applyLedgerPlan([], plan([log("2026-09-10", 1)], [], "2026-09-19"));
    const repriced = quitHabit({ pricePerItem: 30, baselineQuantity: 5 });
    const next = applyLedgerPlan(
      rows,
      plan([log("2026-09-10", 1), log("2026-09-19", 1)], rows, "2026-09-19", localNoon("2026-09-19"), repriced)
    );
    const oldDay = next.find((row) => row.date === "2026-09-10");
    const newDay = next.find((row) => row.date === "2026-09-19");
    assert.equal(oldDay?.unitPriceMinor, 2500, "the final day keeps the price it was measured with");
    assert.equal(oldDay?.baselineQuantity, 4);
    assert.equal(oldDay?.savedMinor, 7500);
    assert.equal(newDay?.unitPriceMinor, 3000);
    assert.equal(newDay?.baselineQuantity, 5);
    assert.equal(newDay?.savedMinor, 12000); // 5 x 30 - 1 x 30
  });

  test("a habit only earns on days it was active", () => {
    const created = quitHabit({ createdAt: localNoon("2026-09-10"), archivedAt: localNoon("2026-09-15") });
    const rows = applyLedgerPlan(
      [],
      plan(
        [log("2026-09-09", 0), log("2026-09-10", 0), log("2026-09-14", 0), log("2026-09-15", 0), log("2026-09-16", 0)],
        [],
        "2026-09-19",
        NOW,
        created
      )
    );
    assert.deepEqual(rows.map((row) => row.date).sort(), ["2026-09-10", "2026-09-14", "2026-09-15"]);
  });

  test("a log in the future never counts", () => {
    const rows = applyLedgerPlan([], plan([log("2026-09-25", 0)], [], "2026-09-19"));
    assert.equal(rows.length, 0);
  });

  test("the phone's date stepping back does not delete a real day's record", () => {
    // 00:05 in Nepal on the 20th: both days have a log, the 19th is final, the 20th provisional.
    const logs = [log("2026-09-19", 5), log("2026-09-20", 1)];
    const rows = applyLedgerPlan([], plan(logs, [], "2026-09-20", "2026-09-19T18:20:00.000Z"));
    assert.deepEqual(rows.map((row) => [row.date, row.finalizedAt !== null]).sort(), [
      ["2026-09-19", true],
      ["2026-09-20", false],
    ]);

    // The phone hops to India time: the same moment reads 23:50 on the 19th.
    const stepBack = plan(logs, rows, "2026-09-19", "2026-09-19T18:21:00.000Z");
    assert.deepEqual(stepBack, { upserts: [], deletes: [] }, "nothing is deleted or rewritten");
    assert.deepEqual(applyLedgerPlan(rows, stepBack), rows);

    // Back on Nepal time everything is still exactly as it was.
    const back = plan(logs, rows, "2026-09-20", "2026-09-19T18:40:00.000Z");
    assert.deepEqual(back, { upserts: [], deletes: [] });
  });

  test("a day after today that has no record yet is still not created", () => {
    const rows = applyLedgerPlan([], plan([log("2026-09-20", 1)], [], "2026-09-19"));
    assert.equal(rows.length, 0);
  });

  test("a deleted log still removes its record, even when the phone's date is behind", () => {
    const rows = applyLedgerPlan([], plan([log("2026-09-19", 1), log("2026-09-20", 1)], [], "2026-09-20"));
    const after = plan([log("2026-09-19", 1)], rows, "2026-09-19");
    assert.deepEqual(after.deletes.map((d) => d.date), ["2026-09-20"], "no log at all for the 20th: the record goes");
  });

  test("unscheduled days do not earn", () => {
    const mondayOnly = quitHabit({ repeatDays: [0] });
    // 2026-09-14 is a Monday, 2026-09-15 a Tuesday.
    const rows = applyLedgerPlan([], plan([log("2026-09-14", 0), log("2026-09-15", 0)], [], "2026-09-19", NOW, mondayOnly));
    assert.deepEqual(rows.map((row) => row.date), ["2026-09-14"]);
  });

  test("a habit without a stored baseline is skipped and its records are left alone", () => {
    const rows = applyLedgerPlan([], plan([log("2026-09-10", 1)], [], "2026-09-19"));
    const lost = quitHabit({ baselineQuantity: null });
    const result = plan([log("2026-09-10", 1)], rows, "2026-09-19", NOW, lost);
    assert.deepEqual(result, { upserts: [], deletes: [] });
  });
});

describe("legacy baselines", () => {
  test("a habit with a stored baseline is recoverable", () => {
    const legacy = quitHabit({ baselineQuantity: 4 });
    assert.equal(needsBaseline(legacy), false);
    assert.deepEqual(getSavingsTerms(legacy), { baselineQuantity: 4, unitPriceMinor: 2500 });
  });

  test("a habit with none is marked unavailable and never guessed from price or logs", () => {
    for (const missing of [null, 0, -3, Number.NaN]) {
      const legacy = quitHabit({ baselineQuantity: missing as number | null, targetAmount: 3, pricePerItem: 25 });
      assert.equal(needsBaseline(legacy), true);
      assert.equal(getSavingsTerms(legacy), null);
    }
    const summary = summaryOf([log(TODAY, 2)], { habits: [quitHabit({ baselineQuantity: null })] });
    assert.equal(summary.hasSufficientData, false);
    assert.equal(summary.potentialSavingsRemainingToday, 0);
    assert.deepEqual(summary.habitsNeedingBaseline, [{ habitId: "smoke", name: "Smoking cigarettes" }]);
  });
});

describe("calendar months", () => {
  const dayRows = (from: string, days: number): LedgerRow[] => {
    const rows: LedgerRow[] = [];
    const start = new Date(`${from}T12:00:00`);
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      rows.push({
        habitId: "smoke",
        date,
        baselineQuantity: 4,
        unitPriceMinor: 2500,
        actualQuantity: 3,
        baselineCostMinor: 10000,
        actualSpendingMinor: 7500,
        savedMinor: 2500,
        finalizedAt: "2026-10-30T00:00:00.000Z",
        updatedAt: "2026-10-30T00:00:00.000Z",
      });
    }
    return rows;
  };

  test("Gregorian month boundaries", () => {
    assert.deepEqual(monthRangeFor("2026-09-19", "gregorian"), { start: "2026-09-01", end: "2026-09-30" });
    assert.deepEqual(monthRangeFor("2026-01-31", "gregorian"), { start: "2026-01-01", end: "2026-01-31" });
    assert.deepEqual(monthRangeFor("2026-02-01", "gregorian"), { start: "2026-02-01", end: "2026-02-28" });
    assert.deepEqual(monthRangeFor("2028-02-10", "gregorian"), { start: "2028-02-01", end: "2028-02-29" });
    assert.deepEqual(monthRangeFor("2026-12-31", "gregorian"), { start: "2026-12-01", end: "2026-12-31" });
    assert.equal(monthRangeFor("2026-02-30", "gregorian"), null);
  });

  test("a day on the boundary belongs to exactly one Gregorian month", () => {
    const rows = dayRows("2026-08-25", 15); // Aug 25 .. Sep 8
    const august = monthRangeFor("2026-08-31", "gregorian")!;
    const september = monthRangeFor("2026-09-01", "gregorian")!;
    assert.equal(sumLedger(rows, august).loggedDays, 7); // 25..31
    assert.equal(sumLedger(rows, september).loggedDays, 8); // 1..8
  });

  test("Bikram Sambat month boundaries are converted to Gregorian dates", () => {
    // 2026-09-19 is 3 Ashwin 2083 - the BS month began on 17 September.
    const range = monthRangeFor("2026-09-19", "bikram_sambat")!;
    assert.equal(range.start, "2026-09-17");
    assert.ok(range.end >= "2026-10-16" && range.end <= "2026-10-18", `unexpected end ${range.end}`);

    // The first and last day of the BS month are inside it; the neighbours belong elsewhere.
    assert.deepEqual(monthRangeFor(range.start, "bikram_sambat"), range);
    assert.deepEqual(monthRangeFor(range.end, "bikram_sambat"), range);
    const before = monthRangeFor("2026-09-16", "bikram_sambat")!;
    assert.equal(before.end, "2026-09-16");
    const after = monthRangeFor(nextDay(range.end), "bikram_sambat")!;
    assert.equal(after.start, nextDay(range.end));
  });

  test("consecutive BS months tile the calendar with no gap or overlap", () => {
    let cursor = monthRangeFor("2026-04-14", "bikram_sambat")!; // around the BS new year
    for (let i = 0; i < 24; i++) {
      const next = monthRangeFor(nextDay(cursor.end), "bikram_sambat")!;
      assert.equal(next.start, nextDay(cursor.end));
      assert.ok(next.end > next.start);
      cursor = next;
    }
  });

  test("switching calendars regroups the same records without changing or duplicating them", () => {
    const rows = dayRows("2026-08-20", 60); // 20 Aug .. 18 Oct
    const frozen = JSON.stringify(rows);
    const habit = quitHabit();
    const gregorian = computeFinancialSummary({
      habits: [habit],
      logsByHabit: {},
      ledger: rows,
      today: "2026-09-19",
      calendarType: "gregorian",
    });
    const bikramSambat = computeFinancialSummary({
      habits: [habit],
      logsByHabit: {},
      ledger: rows,
      today: "2026-09-19",
      calendarType: "bikram_sambat",
    });
    assert.equal(JSON.stringify(rows), frozen, "the ledger itself is untouched");
    assert.equal(gregorian.monthStart, "2026-09-01");
    assert.equal(bikramSambat.monthStart, "2026-09-17");
    assert.notEqual(gregorian.savedThisMonth, bikramSambat.savedThisMonth);

    // Each is exactly its own days at Rs 25 a day, minus today (which is live, not in the
    // ledger figure), so nothing was counted twice.
    assert.equal(gregorian.savedThisMonth, 29 * 25); // 30 days in September
    const bsRange = monthRangeFor("2026-09-19", "bikram_sambat")!;
    const bsDays = Math.round((Date.parse(`${bsRange.end}T00:00:00Z`) - Date.parse(`${bsRange.start}T00:00:00Z`)) / 86400000) + 1;
    assert.equal(bikramSambat.savedThisMonth, (bsDays - 1) * 25);
  });

  test("the goal and 'saved this month' follow the selected calendar's month", () => {
    const rows = [
      { ...dayRowFor("2026-09-16"), savedMinor: 10000 }, // last day of the previous BS month
      { ...dayRowFor("2026-09-17"), savedMinor: 5000 }, // first day of this BS month
    ];
    const summaryFor = (calendarType: "gregorian" | "bikram_sambat") =>
      computeFinancialSummary({ habits: [quitHabit()], logsByHabit: {}, ledger: rows, today: "2026-09-19", calendarType });
    assert.equal(summaryFor("gregorian").savedThisMonth, 150); // both are in September
    assert.equal(summaryFor("bikram_sambat").savedThisMonth, 50); // the 16th is last month's
  });
});

function nextDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dayRowFor(date: string): LedgerRow {
  return {
    habitId: "smoke",
    date,
    baselineQuantity: 4,
    unitPriceMinor: 2500,
    actualQuantity: 3,
    baselineCostMinor: 10000,
    actualSpendingMinor: 7500,
    savedMinor: 2500,
    finalizedAt: "2026-09-30T00:00:00.000Z",
    updatedAt: "2026-09-30T00:00:00.000Z",
  };
}

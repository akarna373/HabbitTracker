import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { addDays, todayISO } from "../lib/dates";
import { computeFinancialSummary } from "../lib/financialSummary";
import { buildReflectionCards, type ReflectionCardData } from "../lib/reflection";
import type { LedgerRow } from "../lib/savingsLedger";
import { buildShareCard, formatMonthLabel, toFileUri } from "../lib/shareCard";
import { localNoon, log, quitHabit } from "./helpers/fixtures";

const TODAY = "2026-09-19";
const rs = (amount: number) => `Rs ${amount}`;

// A finished day in the ledger that saved `saved` rupees.
function finishedDay(date: string, saved: number, quantity = 3): LedgerRow {
  return {
    habitId: "smoke",
    date,
    baselineQuantity: 4,
    unitPriceMinor: 2500,
    actualQuantity: quantity,
    baselineCostMinor: 10000,
    actualSpendingMinor: 10000 - saved * 100,
    savedMinor: saved * 100,
    finalizedAt: "2026-09-20T00:00:00.000Z",
    updatedAt: "2026-09-20T00:00:00.000Z",
  };
}

// The pieces of a reflection card the share card reads.
function card(streak: number, week: string | null): ReflectionCardData {
  return {
    id: "overview",
    kind: "overview",
    title: "Today",
    message: "",
    streak,
    ring: null,
    stats: week === null ? [] : [{ label: "This week", value: week }],
    week: null,
  };
}

function build(
  overrides: {
    habitName?: string;
    rows?: LedgerRow[];
    logs?: ReturnType<typeof log>[];
    goal?: number | null;
    cards?: ReflectionCardData[];
    calendar?: "gregorian" | "bikram_sambat";
  } = {}
) {
  const habit = quitHabit({ name: overrides.habitName ?? "Smoking cigarettes" });
  const summary = computeFinancialSummary({
    habits: [habit],
    logsByHabit: { smoke: overrides.logs ?? [] },
    ledger: overrides.rows ?? [],
    today: TODAY,
    calendarType: overrides.calendar ?? "gregorian",
  });
  return buildShareCard({
    summary,
    monthlyGoal: overrides.goal ?? null,
    reflectionCards: overrides.cards ?? [card(2, "29%")],
    calendarType: overrides.calendar ?? "gregorian",
    formatMoney: rs,
  });
}

describe("share card with savings", () => {
  test("leads with what was saved this month", () => {
    const data = build({ rows: [finishedDay("2026-09-17", 90), finishedDay("2026-09-18", 100)] });
    assert.ok(data);
    assert.equal(data.heroLabel, "Saved this month");
    assert.equal(data.heroValue, "Rs 190");
    assert.equal(data.monthLabel, "September 2026");
    assert.equal(data.goal, null);
  });

  test("shows goal progress when a goal is set", () => {
    const data = build({ rows: [finishedDay("2026-09-17", 90)], goal: 3000 });
    assert.deepEqual(data?.goal, { percent: 3, caption: "3% of monthly goal" });
  });

  test("says so once the goal is reached", () => {
    const data = build({ rows: [finishedDay("2026-09-17", 100)], goal: 100 });
    assert.equal(data?.goal?.caption, "Monthly goal reached");
    assert.equal(data?.goal?.percent, 100);
  });

  test("clean days, best streak and this week, in that order, at most three", () => {
    const data = build({
      rows: [finishedDay("2026-09-17", 100, 0)],
      logs: [log(TODAY, 0)],
      cards: [card(5, "80%")],
    });
    assert.deepEqual(data?.stats, [
      { label: "Clean days", value: "2" },
      { label: "Best streak", value: "5 days" },
      { label: "This week", value: "80%" },
    ]);
  });

  test("singular wording for exactly one", () => {
    const data = build({ rows: [finishedDay("2026-09-17", 100, 0)], cards: [card(1, null)] });
    assert.deepEqual(data?.stats, [
      { label: "Clean day", value: "1" },
      { label: "Best streak", value: "1 day" },
    ]);
  });

  test("nothing worth sharing yet gives no card", () => {
    assert.equal(build({ cards: [card(0, "0%")] }), null);
  });

  test("a day with a saving is enough on its own", () => {
    assert.ok(build({ rows: [finishedDay("2026-09-17", 25)], cards: [card(0, null)] }));
  });
});

describe("no personal data on the card", () => {
  const SECRET = "Zorblax private habit";

  test("no habit name appears anywhere in the card", () => {
    const data = build({
      habitName: SECRET,
      rows: [finishedDay("2026-09-17", 90)],
      logs: [log(TODAY, 1)],
      goal: 3000,
      cards: [card(4, "50%")],
    });
    assert.ok(data);
    const everything = JSON.stringify(data).toLowerCase();
    assert.ok(!everything.includes("zorblax"), "the habit name must never reach the card");
    assert.ok(!everything.includes("private"), everything);
  });

  test("the card holds only strings and numbers built by the builder (no free text passes through)", () => {
    const data = build({ rows: [finishedDay("2026-09-17", 90)], goal: 3000 });
    const allowed = /^(Saved this month|Best streak|Clean days?|This week|Rs \d+|\d+ days?|\d+%|\d+% of monthly goal|Monthly goal reached|[A-Za-z]+ \d{4}|\d+)$/;
    const texts = [data!.monthLabel, data!.heroLabel, data!.heroValue, data!.goal!.caption, ...data!.stats.flatMap((s) => [s.label, s.value])];
    for (const text of texts) assert.match(text, allowed, `unexpected text on the card: "${text}"`);
  });
});

describe("share card without savings", () => {
  // Uses the real reflection cards and the real today, so a renamed label breaks this test.
  const today = todayISO();
  const jogging = quitHabit({
    id: "jog",
    kind: "good",
    category: "fitness",
    templateId: "jogging",
    name: "Morning jog",
    hasCost: false,
    baselineQuantity: null,
    pricePerItem: null,
    trackingMethod: "checkin",
    createdAt: localNoon(addDays(today, -10)),
  });
  const logs = [0, 1, 2].map((n) => log(addDays(today, -n), 1, { habitId: "jog", id: `jog-${n}` }));

  function buildJogging() {
    const cards = buildReflectionCards({ habits: [jogging], logsByHabit: { jog: logs }, today });
    const summary = computeFinancialSummary({ habits: [jogging], logsByHabit: { jog: logs }, ledger: [], today, calendarType: "gregorian" });
    return buildShareCard({ summary, monthlyGoal: null, reflectionCards: cards, calendarType: "gregorian", formatMoney: rs });
  }

  test("leads with the streak", () => {
    const data = buildJogging();
    assert.ok(data);
    assert.equal(data.heroLabel, "Best streak");
    assert.equal(data.heroValue, "3 days");
    assert.equal(data.goal, null);
  });

  test("adds this week's completion from the real reflection cards", () => {
    const data = buildJogging();
    assert.ok(data?.stats.some((s) => s.label === "This week" && /^\d+%$/.test(s.value)), JSON.stringify(data));
  });

  test("and never names the habit", () => {
    assert.ok(!JSON.stringify(buildJogging()).toLowerCase().includes("jog"));
  });

  test("no streak, no card", () => {
    const summary = computeFinancialSummary({ habits: [jogging], logsByHabit: {}, ledger: [], today, calendarType: "gregorian" });
    const cards = buildReflectionCards({ habits: [jogging], logsByHabit: {}, today });
    assert.equal(buildShareCard({ summary, monthlyGoal: null, reflectionCards: cards, calendarType: "gregorian", formatMoney: rs }), null);
  });
});

describe("month label", () => {
  test("English months", () => {
    assert.equal(formatMonthLabel("2026-09-01", "gregorian"), "September 2026");
    assert.equal(formatMonthLabel("2028-02-29", "gregorian"), "February 2028");
  });

  test("Bikram Sambat months use the Nepali name and digits", () => {
    // 17 September 2026 is 1 Ashwin 2083.
    assert.equal(formatMonthLabel("2026-09-17", "bikram_sambat"), "आश्विन २०८३");
  });

  test("a bad date gives no label instead of a wrong one", () => {
    assert.equal(formatMonthLabel("", "gregorian"), "");
    assert.equal(formatMonthLabel("2026-02-30", "gregorian"), "");
  });
});

describe("file URI", () => {
  test("adds file:// to a bare path and leaves real URIs alone", () => {
    assert.equal(toFileUri("/data/user/0/app/cache/card.png"), "file:///data/user/0/app/cache/card.png");
    assert.equal(toFileUri("file:///cache/card.png"), "file:///cache/card.png");
    assert.equal(toFileUri("content://media/external/images/1"), "content://media/external/images/1");
  });
});

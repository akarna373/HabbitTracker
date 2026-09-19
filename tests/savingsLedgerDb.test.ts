import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { computeFinancialSummary } from "../lib/financialSummary";
import { upsertLoggedAmount } from "../lib/logWrites";
import { monthRangeFor } from "../lib/monthRange";
import { sumLedger, type LedgerRow } from "../lib/savingsLedger";
import {
  deleteSavingsDataForHabit,
  ensureTermsHistory,
  loadLedgerRows,
  loadTermsHistory,
  migrateAmountLoggedColumn,
  syncSavingsLedger,
  updateHabitTerms,
} from "../lib/savingsLedgerDb";
import type { DailyLog, Habit } from "../lib/types";
import { quitHabit, localNoon } from "./helpers/fixtures";
import { insertHabit, openTestDb, type TestDb } from "./helpers/testDb";

// These run the app's real SQL against an in-memory SQLite database that uses the app's
// real table definitions.

const SEPTEMBER = { start: "2026-09-01", end: "2026-09-30" };
const NEW = { baselineQuantity: 5, pricePerItem: 30 };

function legacyLog(db: TestDb, date: string, amount: number, extras: { reflection?: string; microtasks?: string } = {}) {
  db.raw
    .prepare(
      "INSERT INTO daily_logs (id, habitId, date, amount, microtasksDone, reflection) VALUES (?,?,?,?,?,?)"
    )
    .run(`log-${date}`, "smoke", date, amount, extras.microtasks ?? "[]", extras.reflection ?? null);
}

function flags(db: TestDb): Record<string, number> {
  const rows = db.raw.prepare("SELECT date, amountLogged FROM daily_logs ORDER BY date").all() as {
    date: string;
    amountLogged: number;
  }[];
  return Object.fromEntries(rows.map((row) => [row.date, row.amountLogged]));
}

// Mirrors how the store reads its state back from the database.
async function loadLogs(db: TestDb): Promise<Record<string, DailyLog[]>> {
  const rows = await db.getAllAsync<Omit<DailyLog, "amountLogged"> & { amountLogged: number }>(
    "SELECT * FROM daily_logs",
    []
  );
  const byHabit: Record<string, DailyLog[]> = {};
  for (const row of rows) {
    (byHabit[row.habitId] ??= []).push({ ...row, microtasksDone: [], amountLogged: row.amountLogged !== 0 });
  }
  return byHabit;
}

function summaryFrom(habits: Habit[], logsByHabit: Record<string, DailyLog[]>, ledger: LedgerRow[], today: string) {
  return computeFinancialSummary({ habits, logsByHabit, ledger, today, calendarType: "gregorian" });
}

async function freshDb(): Promise<TestDb> {
  const db = openTestDb();
  insertHabit(db, { id: "smoke", name: "Smoking cigarettes", baselineQuantity: 4, pricePerItem: 25 });
  await migrateAmountLoggedColumn(db);
  return db;
}

describe("amountLogged migration", () => {
  test("legacy rows: real reports stay, reflection/microtask placeholders stop counting as zero", async () => {
    const db = openTestDb();
    insertHabit(db, { id: "smoke", baselineQuantity: 4, pricePerItem: 25 });
    legacyLog(db, "2026-09-10", 2); // a real count
    legacyLog(db, "2026-09-11", 0); // an explicit "I stayed clean" (or a - after a +)
    legacyLog(db, "2026-09-12", 0, { reflection: "hard evening" }); // only a reflection was saved
    legacyLog(db, "2026-09-13", 0, { microtasks: '["breathe"]' }); // only a microtask was ticked
    legacyLog(db, "2026-09-14", 3, { reflection: "slipped" }); // a real count that also has a reflection

    assert.equal(await migrateAmountLoggedColumn(db), true, "runs on the first launch after the update");
    assert.deepEqual(flags(db), {
      "2026-09-10": 1,
      "2026-09-11": 1,
      "2026-09-12": 0,
      "2026-09-13": 0,
      "2026-09-14": 1,
    });
    assert.equal((db.raw.prepare("SELECT COUNT(*) AS n FROM daily_logs").get() as { n: number }).n, 5, "nothing is deleted");
  });

  test("runs only once: later launches never re-flag a row", async () => {
    const db = openTestDb();
    legacyLog(db, "2026-09-12", 0, { reflection: "hard evening" });
    assert.equal(await migrateAmountLoggedColumn(db), true);
    assert.equal(flags(db)["2026-09-12"], 0);

    // The person now logs a real zero that day; the row keeps its reflection.
    await upsertLoggedAmount(db, { id: "x", habitId: "smoke", date: "2026-09-12", amount: 0 });
    assert.equal(flags(db)["2026-09-12"], 1);

    assert.equal(await migrateAmountLoggedColumn(db), false, "the column already exists");
    assert.equal(flags(db)["2026-09-12"], 1, "not reset by a later launch");
  });
});

describe("syncSavingsLedger", () => {
  test("builds the ledger from existing logs and finalizes past days", async () => {
    const db = await freshDb();
    legacyLog(db, "2026-09-10", 2);
    legacyLog(db, "2026-09-11", 0);
    legacyLog(db, "2026-09-14", 3);
    db.raw.exec("UPDATE daily_logs SET amountLogged = 1");

    await syncSavingsLedger(db, { today: "2026-09-19", nowISO: "2026-09-19T08:00:00.000Z" });
    const rows = await loadLedgerRows(db);
    assert.deepEqual(
      rows.map((row) => [row.date, row.actualQuantity, row.savedMinor, row.finalizedAt !== null]).sort(),
      [
        ["2026-09-10", 2, 5000, true],
        ["2026-09-11", 0, 10000, true],
        ["2026-09-14", 3, 2500, true],
      ]
    );
    assert.equal(sumLedger(rows, SEPTEMBER).savedMinor, 17500);
  });

  test("running it repeatedly changes nothing and never credits a day twice", async () => {
    const db = await freshDb();
    await upsertLoggedAmount(db, { id: "a", habitId: "smoke", date: "2026-09-10", amount: 1 });
    await upsertLoggedAmount(db, { id: "b", habitId: "smoke", date: "2026-09-11", amount: 0 });

    const first = await syncSavingsLedger(db, { today: "2026-09-19", nowISO: "2026-09-19T08:00:00.000Z" });
    assert.equal(first.upserts.length, 2);
    const before = await loadLedgerRows(db);

    for (let i = 0; i < 4; i++) {
      const again = await syncSavingsLedger(db, { today: "2026-09-19", nowISO: `2026-09-19T0${9 + i}:00:00.000Z` });
      assert.deepEqual(again, { upserts: [], deletes: [] });
    }
    assert.deepEqual(await loadLedgerRows(db), before, "byte-for-byte the same, updatedAt included");
    assert.equal(sumLedger(before, SEPTEMBER).savedMinor, 7500 + 10000);
  });

  test("the database refuses a second record for the same habit and day", async () => {
    const db = await freshDb();
    await upsertLoggedAmount(db, { id: "a", habitId: "smoke", date: "2026-09-10", amount: 1 });
    await syncSavingsLedger(db, { today: "2026-09-19" });

    assert.throws(() => {
      db.raw
        .prepare(
          `INSERT INTO daily_savings (habitId, date, baselineQuantity, unitPriceMinor, actualQuantity,
                                      baselineCostMinor, actualSpendingMinor, savedMinor, finalizedAt, updatedAt)
           VALUES ('smoke','2026-09-10',4,2500,1,10000,2500,7500,NULL,'x')`
        )
        .run();
    }, /constraint|UNIQUE/i);
  });

  test("a day logged before midnight is finalized by the first run after it, even after days offline", async () => {
    const db = await freshDb();
    await upsertLoggedAmount(db, { id: "a", habitId: "smoke", date: "2026-09-19", amount: 1 });

    await syncSavingsLedger(db, { today: "2026-09-19", nowISO: "2026-09-19T23:50:00.000Z" });
    assert.equal((await loadLedgerRows(db))[0].finalizedAt, null, "still provisional while the day lasts");

    // Android killed the app; nothing ran at midnight, or the next day, or the day after.
    await syncSavingsLedger(db, { today: "2026-09-22", nowISO: "2026-09-22T07:30:00.000Z" });
    const rows = await loadLedgerRows(db);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].finalizedAt, "2026-09-22T07:30:00.000Z");
    assert.equal(rows[0].savedMinor, 7500);
  });

  test("a late log after 11:58 PM still lands on its own day and is finalized at rollover", async () => {
    const db = await freshDb();
    await upsertLoggedAmount(db, { id: "a", habitId: "smoke", date: "2026-09-19", amount: 1 });
    await syncSavingsLedger(db, { today: "2026-09-19", nowISO: "2026-09-19T23:40:00.000Z" });
    // 11:59 PM: one more cigarette.
    await upsertLoggedAmount(db, { id: "a", habitId: "smoke", date: "2026-09-19", amount: 2 });
    await syncSavingsLedger(db, { today: "2026-09-19", nowISO: "2026-09-19T23:59:00.000Z" });
    let rows = await loadLedgerRows(db);
    assert.equal(rows[0].actualQuantity, 2);
    assert.equal(rows[0].finalizedAt, null);

    await syncSavingsLedger(db, { today: "2026-09-20", nowISO: "2026-09-20T00:01:00.000Z" });
    rows = await loadLedgerRows(db);
    assert.equal(rows[0].actualQuantity, 2);
    assert.equal(rows[0].savedMinor, 5000);
    assert.equal(rows[0].finalizedAt, "2026-09-20T00:01:00.000Z");
  });

  test("two syncs started together still leave one consistent set of records", async () => {
    const db = await freshDb();
    for (const day of ["10", "11", "12"]) {
      await upsertLoggedAmount(db, { id: day, habitId: "smoke", date: `2026-09-${day}`, amount: 1 });
    }
    await Promise.all([
      syncSavingsLedger(db, { today: "2026-09-19" }),
      syncSavingsLedger(db, { today: "2026-09-19" }),
      syncSavingsLedger(db, { today: "2026-09-19" }),
    ]);
    assert.equal((await loadLedgerRows(db)).length, 3);
  });

  test("a notification action's write is reflected immediately", async () => {
    const db = await freshDb();
    const habits = [quitHabit()];
    const today = "2026-09-19";

    let logs = await loadLogs(db);
    assert.equal(summaryFrom(habits, logs, await loadLedgerRows(db), today).potentialSavingsRemainingToday, 100);

    // The hotspot alert's "I smoked" runs with no app UI: it writes the count with the shared
    // helper and syncs the ledger straight away.
    await upsertLoggedAmount(db, { id: "n1", habitId: "smoke", date: today, amount: 1 });
    await syncSavingsLedger(db, { today });
    logs = await loadLogs(db);
    let ledger = await loadLedgerRows(db);
    assert.equal(summaryFrom(habits, logs, ledger, today).potentialSavingsRemainingToday, 75);
    assert.equal(ledger[0].actualQuantity, 1);
    assert.equal(ledger[0].finalizedAt, null);

    await upsertLoggedAmount(db, { id: "n1", habitId: "smoke", date: today, amount: 2 });
    await syncSavingsLedger(db, { today });
    logs = await loadLogs(db);
    ledger = await loadLedgerRows(db);
    assert.equal(summaryFrom(habits, logs, ledger, today).potentialSavingsRemainingToday, 50);
    assert.equal(ledger.length, 1);
  });

  test("editing or deleting an older log recomputes the month instead of adding to it", async () => {
    const db = await freshDb();
    await upsertLoggedAmount(db, { id: "a", habitId: "smoke", date: "2026-09-10", amount: 1 }); // saves 75
    await upsertLoggedAmount(db, { id: "b", habitId: "smoke", date: "2026-09-11", amount: 0 }); // saves 100
    await syncSavingsLedger(db, { today: "2026-09-19" });
    assert.equal(sumLedger(await loadLedgerRows(db), SEPTEMBER).savedMinor, 17500);

    // The person fixes the 10th: it was really 3.
    db.raw.prepare("UPDATE daily_logs SET amount = 3 WHERE date = '2026-09-10'").run();
    await syncSavingsLedger(db, { today: "2026-09-19" });
    let rows = await loadLedgerRows(db);
    assert.equal(rows.find((row) => row.date === "2026-09-10")?.savedMinor, 2500);
    assert.equal(sumLedger(rows, SEPTEMBER).savedMinor, 12500, "75 became 25; the total was recomputed, not adjusted");

    db.raw.prepare("DELETE FROM daily_logs WHERE date = '2026-09-11'").run();
    await syncSavingsLedger(db, { today: "2026-09-19" });
    rows = await loadLedgerRows(db);
    assert.deepEqual(rows.map((row) => row.date), ["2026-09-10"]);
    assert.equal(sumLedger(rows, SEPTEMBER).savedMinor, 2500);
  });

  test("a later price change affects future days only", async () => {
    const db = await freshDb();
    await upsertLoggedAmount(db, { id: "a", habitId: "smoke", date: "2026-09-10", amount: 1 });
    await syncSavingsLedger(db, { today: "2026-09-19" });

    await updateHabitTerms(db, "smoke", { baselineQuantity: 4, pricePerItem: 30 }, "from_today", { today: "2026-09-19" });
    await upsertLoggedAmount(db, { id: "b", habitId: "smoke", date: "2026-09-19", amount: 1 });
    await syncSavingsLedger(db, { today: "2026-09-19" });

    const rows = await loadLedgerRows(db);
    assert.equal(rows.find((row) => row.date === "2026-09-10")?.unitPriceMinor, 2500);
    assert.equal(rows.find((row) => row.date === "2026-09-10")?.savedMinor, 7500);
    assert.equal(rows.find((row) => row.date === "2026-09-19")?.unitPriceMinor, 3000);
    assert.equal(rows.find((row) => row.date === "2026-09-19")?.savedMinor, 9000);
  });

  test("a row saved only for a reflection or microtask earns nothing, until a real log arrives", async () => {
    const db = await freshDb();
    // What saveReflection / toggleMicrotask write for a day with no row yet.
    db.raw
      .prepare(
        "INSERT INTO daily_logs (id, habitId, date, amount, amountB, microtasksDone, reflection, amountLogged) VALUES ('r','smoke','2026-09-15',0,NULL,'[]','a hard day',0)"
      )
      .run();
    await syncSavingsLedger(db, { today: "2026-09-19" });
    assert.equal((await loadLedgerRows(db)).length, 0);

    // "I stayed clean today" logs a real zero on the same row.
    await upsertLoggedAmount(db, { id: "r", habitId: "smoke", date: "2026-09-15", amount: 0 });
    await syncSavingsLedger(db, { today: "2026-09-19" });
    const rows = await loadLedgerRows(db);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].savedMinor, 10000);
  });

  test("archiving stops new days counting but keeps the days already earned", async () => {
    const db = await freshDb();
    await upsertLoggedAmount(db, { id: "a", habitId: "smoke", date: "2026-09-10", amount: 1 });
    await syncSavingsLedger(db, { today: "2026-09-12" });

    db.raw.prepare("UPDATE habits SET archivedAt = '2026-09-12T12:00:00.000Z' WHERE id = 'smoke'").run();
    await upsertLoggedAmount(db, { id: "b", habitId: "smoke", date: "2026-09-16", amount: 0 }); // after archiving
    await syncSavingsLedger(db, { today: "2026-09-19" });
    assert.deepEqual((await loadLedgerRows(db)).map((row) => row.date), ["2026-09-10"]);
  });

  test("deleting a habit removes its records", async () => {
    const db = await freshDb();
    await upsertLoggedAmount(db, { id: "a", habitId: "smoke", date: "2026-09-10", amount: 1 });
    await syncSavingsLedger(db, { today: "2026-09-19" });
    assert.equal((await loadLedgerRows(db)).length, 1);
    await deleteSavingsDataForHabit(db, "smoke");
    assert.equal((await loadLedgerRows(db)).length, 0);
  });
});

describe("changing baseline and price", () => {
  // 4 x Rs 25 to begin with. 10 Sep: had 1 (saved 75). 11 Sep: had 0 (saved 100). Today, 19 Sep: had 1.
  async function seeded(): Promise<TestDb> {
    const db = await freshDb();
    await upsertLoggedAmount(db, { id: "a", habitId: "smoke", date: "2026-09-10", amount: 1 });
    await upsertLoggedAmount(db, { id: "b", habitId: "smoke", date: "2026-09-11", amount: 0 });
    await upsertLoggedAmount(db, { id: "c", habitId: "smoke", date: "2026-09-19", amount: 1 });
    await syncSavingsLedger(db, { today: "2026-09-19", nowISO: "2026-09-19T08:00:00.000Z" });
    return db;
  }
  const NEW_TERMS = { baselineQuantity: 5, pricePerItem: 30 };
  const byDate = (rows: LedgerRow[], date: string) => rows.find((row) => row.date === date);

  test("'from today on': finished days keep their old values, today and later use the new ones", async () => {
    const db = await seeded();
    const before = await loadLedgerRows(db);

    const saved = await updateHabitTerms(db, "smoke", NEW_TERMS, "from_today", { today: "2026-09-19", nowISO: "2026-09-19T09:00:00.000Z" });
    assert.equal(saved, true);
    const rows = await loadLedgerRows(db);

    for (const date of ["2026-09-10", "2026-09-11"]) {
      assert.deepEqual(byDate(rows, date), byDate(before, date), `${date} is finished and must not change at all`);
    }
    // Today is still provisional, so it follows the new terms.
    const today = byDate(rows, "2026-09-19")!;
    assert.equal(today.baselineQuantity, 5);
    assert.equal(today.unitPriceMinor, 3000);
    assert.equal(today.savedMinor, 12000); // 5 x 30 - 1 x 30
    assert.equal(today.finalizedAt, null);

    // A day logged after the change is measured with the new terms too.
    await upsertLoggedAmount(db, { id: "d", habitId: "smoke", date: "2026-09-20", amount: 2 });
    await syncSavingsLedger(db, { today: "2026-09-20", nowISO: "2026-09-20T09:00:00.000Z" });
    const later = byDate(await loadLedgerRows(db), "2026-09-20")!;
    assert.equal(later.savedMinor, 9000); // 5 x 30 - 2 x 30
    // ...and yesterday, now over, is final with the new terms it had.
    assert.equal(byDate(await loadLedgerRows(db), "2026-09-19")!.finalizedAt, "2026-09-20T09:00:00.000Z");
  });

  test("'correct all days': every logged day is recalculated and stays final", async () => {
    const db = await seeded();
    const saved = await updateHabitTerms(db, "smoke", NEW_TERMS, "all_days", { today: "2026-09-19", nowISO: "2026-09-19T09:00:00.000Z" });
    assert.equal(saved, true);
    const rows = await loadLedgerRows(db);

    assert.equal(rows.length, 3, "same days, no duplicates");
    assert.equal(byDate(rows, "2026-09-10")!.savedMinor, 12000); // 5 x 30 - 1 x 30
    assert.equal(byDate(rows, "2026-09-11")!.savedMinor, 15000); // 5 x 30
    assert.equal(byDate(rows, "2026-09-19")!.savedMinor, 12000);
    for (const row of rows) {
      assert.equal(row.baselineQuantity, 5);
      assert.equal(row.unitPriceMinor, 3000);
    }
    assert.equal(byDate(rows, "2026-09-10")!.finalizedAt, "2026-09-19T09:00:00.000Z", "finished days are final again");
    assert.equal(byDate(rows, "2026-09-19")!.finalizedAt, null, "today is still provisional");
    assert.equal(sumLedger(rows, SEPTEMBER).savedMinor, 12000 + 15000);
  });

  test("the habit itself is updated", async () => {
    const db = await seeded();
    await updateHabitTerms(db, "smoke", NEW_TERMS, "from_today", { today: "2026-09-19" });
    const habit = db.raw.prepare("SELECT baselineQuantity, pricePerItem FROM habits WHERE id = 'smoke'").get() as {
      baselineQuantity: number;
      pricePerItem: number;
    };
    assert.deepEqual({ ...habit }, { baselineQuantity: 5, pricePerItem: 30 });
  });

  test("applying the same change again changes nothing", async () => {
    const db = await seeded();
    await updateHabitTerms(db, "smoke", NEW_TERMS, "all_days", { today: "2026-09-19", nowISO: "2026-09-19T09:00:00.000Z" });
    const once = await loadLedgerRows(db);
    await updateHabitTerms(db, "smoke", NEW_TERMS, "all_days", { today: "2026-09-19", nowISO: "2026-09-19T09:00:00.000Z" });
    assert.deepEqual(await loadLedgerRows(db), once);
    await updateHabitTerms(db, "smoke", NEW_TERMS, "from_today", { today: "2026-09-19", nowISO: "2026-09-19T10:00:00.000Z" });
    assert.deepEqual(await loadLedgerRows(db), once);
  });

  test("a free item (price 0) is allowed", async () => {
    const db = await seeded();
    assert.equal(await updateHabitTerms(db, "smoke", { baselineQuantity: 4, pricePerItem: 0 }, "all_days", { today: "2026-09-19" }), true);
    assert.ok((await loadLedgerRows(db)).every((row) => row.savedMinor === 0 && row.baselineCostMinor === 0));
  });

  test("unusable values change nothing", async () => {
    const db = await seeded();
    const rowsBefore = await loadLedgerRows(db);
    const habitBefore = db.raw.prepare("SELECT baselineQuantity, pricePerItem FROM habits WHERE id = 'smoke'").get();
    for (const terms of [
      { baselineQuantity: 0, pricePerItem: 25 },
      { baselineQuantity: -2, pricePerItem: 25 },
      { baselineQuantity: Number.NaN, pricePerItem: 25 },
      { baselineQuantity: 4, pricePerItem: -1 },
      { baselineQuantity: 4, pricePerItem: Number.POSITIVE_INFINITY },
    ]) {
      assert.equal(await updateHabitTerms(db, "smoke", terms, "all_days", { today: "2026-09-19" }), false);
    }
    assert.deepEqual(await loadLedgerRows(db), rowsBefore);
    assert.deepEqual(db.raw.prepare("SELECT baselineQuantity, pricePerItem FROM habits WHERE id = 'smoke'").get(), habitBefore);
  });

  test("only a cost-tracked quit habit can be changed", async () => {
    const db = await seeded();
    insertHabit(db, { id: "med", kind: "good", hasCost: true, baselineQuantity: null, pricePerItem: 30 });
    insertHabit(db, { id: "free", kind: "quit", hasCost: false, baselineQuantity: 60, pricePerItem: null });
    assert.equal(await updateHabitTerms(db, "med", { baselineQuantity: 3, pricePerItem: 10 }, "all_days", { today: "2026-09-19" }), false);
    assert.equal(await updateHabitTerms(db, "free", { baselineQuantity: 3, pricePerItem: 10 }, "all_days", { today: "2026-09-19" }), false);
    assert.equal(await updateHabitTerms(db, "no-such-habit", NEW_TERMS, "all_days", { today: "2026-09-19" }), false);
    const med = db.raw.prepare("SELECT baselineQuantity, pricePerItem FROM habits WHERE id = 'med'").get() as { baselineQuantity: null; pricePerItem: number };
    assert.deepEqual({ ...med }, { baselineQuantity: null, pricePerItem: 30 });
  });

  test("a change to one habit never touches another habit's records", async () => {
    const db = await seeded();
    insertHabit(db, { id: "chew", name: "Chewing", baselineQuantity: 4, pricePerItem: 45 });
    db.raw.prepare("INSERT INTO daily_logs (id, habitId, date, amount, microtasksDone, amountLogged) VALUES ('x','chew','2026-09-18',2,'[]',1)").run();
    await syncSavingsLedger(db, { today: "2026-09-19" });
    const chewBefore = (await loadLedgerRows(db)).filter((row) => row.habitId === "chew");
    assert.equal(chewBefore.length, 1);

    await updateHabitTerms(db, "smoke", NEW_TERMS, "all_days", { today: "2026-09-19" });
    assert.deepEqual((await loadLedgerRows(db)).filter((row) => row.habitId === "chew"), chewBefore);
  });
});

describe("price and baseline history", () => {
  const at = (rows: LedgerRow[], date: string) => rows.find((row) => row.date === date)!;

  test("habits from before the history existed get one entry: what they have now, from the day they were created", async () => {
    const db = openTestDb();
    insertHabit(db, { id: "smoke", baselineQuantity: 5, pricePerItem: 25, createdAt: localNoon("2026-09-17") });
    insertHabit(db, { id: "free", kind: "quit", hasCost: false, baselineQuantity: 60, pricePerItem: null });

    await ensureTermsHistory(db);
    assert.deepEqual(await loadTermsHistory(db), {
      smoke: [{ effectiveFrom: "2026-09-17", baselineQuantity: 5, pricePerItem: 25 }],
    });
    await ensureTermsHistory(db); // repeating adds nothing
    assert.equal((await loadTermsHistory(db)).smoke.length, 1);
  });

  test("a price rise applies only from the day it was made, on every later rebuild too", async () => {
    const db = await freshDb(); // 4 x Rs 25, created 1 Aug
    await upsertLoggedAmount(db, { id: "a", habitId: "smoke", date: "2026-09-10", amount: 1 });
    await upsertLoggedAmount(db, { id: "b", habitId: "smoke", date: "2026-09-14", amount: 2 });
    await syncSavingsLedger(db, { today: "2026-09-15", nowISO: "2026-09-15T08:00:00.000Z" });

    // On the 15th the price goes from Rs 25 to Rs 30.
    await updateHabitTerms(db, "smoke", { baselineQuantity: 4, pricePerItem: 30 }, "from_today", { today: "2026-09-15" });
    await upsertLoggedAmount(db, { id: "c", habitId: "smoke", date: "2026-09-16", amount: 2 });
    await syncSavingsLedger(db, { today: "2026-09-17", nowISO: "2026-09-17T08:00:00.000Z" });

    let rows = await loadLedgerRows(db);
    assert.equal(at(rows, "2026-09-10").unitPriceMinor, 2500);
    assert.equal(at(rows, "2026-09-14").unitPriceMinor, 2500);
    assert.equal(at(rows, "2026-09-16").unitPriceMinor, 3000);
    assert.equal(at(rows, "2026-09-14").savedMinor, 5000); // (4 - 2) x 25
    assert.equal(at(rows, "2026-09-16").savedMinor, 6000); // (4 - 2) x 30

    // The history alone is enough to reproduce every day: wipe the ledger and rebuild it.
    const before = rows.map((row) => [row.date, row.unitPriceMinor, row.savedMinor]);
    db.raw.exec("DELETE FROM daily_savings");
    await syncSavingsLedger(db, { today: "2026-09-17", nowISO: "2026-09-17T09:00:00.000Z" });
    rows = await loadLedgerRows(db);
    assert.deepEqual(rows.map((row) => [row.date, row.unitPriceMinor, row.savedMinor]).sort(), before.sort());
  });

  test("changing the price before the first sync still keeps the old price for earlier days", async () => {
    // No history and no ledger yet - the change itself must record the price being replaced.
    const db = await freshDb();
    await upsertLoggedAmount(db, { id: "a", habitId: "smoke", date: "2026-09-10", amount: 1 });
    await updateHabitTerms(db, "smoke", { baselineQuantity: 4, pricePerItem: 30 }, "from_today", { today: "2026-09-15" });
    await syncSavingsLedger(db, { today: "2026-09-17" });
    assert.equal(at(await loadLedgerRows(db), "2026-09-10").unitPriceMinor, 2500);
    assert.equal(at(await loadLedgerRows(db), "2026-09-10").savedMinor, 7500);
  });

  test("two changes on the same day keep only the later one for that day", async () => {
    const db = await freshDb();
    await updateHabitTerms(db, "smoke", { baselineQuantity: 4, pricePerItem: 30 }, "from_today", { today: "2026-09-15" });
    await updateHabitTerms(db, "smoke", { baselineQuantity: 4, pricePerItem: 32 }, "from_today", { today: "2026-09-15" });
    const history = (await loadTermsHistory(db)).smoke;
    assert.deepEqual(history.map((e) => [e.effectiveFrom, e.pricePerItem]), [
      ["2026-08-01", 25],
      ["2026-09-15", 32],
    ]);
  });

  test("'correct all days' replaces the history with one entry from the day it was created", async () => {
    const db = await freshDb();
    await updateHabitTerms(db, "smoke", { baselineQuantity: 4, pricePerItem: 30 }, "from_today", { today: "2026-09-15" });
    await updateHabitTerms(db, "smoke", { baselineQuantity: 5, pricePerItem: 20 }, "all_days", { today: "2026-09-16" });
    assert.deepEqual((await loadTermsHistory(db)).smoke, [{ effectiveFrom: "2026-08-01", baselineQuantity: 5, pricePerItem: 20 }]);
  });

  test("a baseline change moves the targets from then on and leaves finished days alone", async () => {
    const db = await freshDb();
    await upsertLoggedAmount(db, { id: "a", habitId: "smoke", date: "2026-09-10", amount: 3 });
    await syncSavingsLedger(db, { today: "2026-09-12" });
    await updateHabitTerms(db, "smoke", { baselineQuantity: 8, pricePerItem: 25 }, "from_today", { today: "2026-09-12" });
    const rows = await loadLedgerRows(db);
    assert.equal(at(rows, "2026-09-10").baselineQuantity, 4, "the 10th was measured against 4 and stays that way");
    assert.equal(at(rows, "2026-09-10").savedMinor, 2500);
    const history = (await loadTermsHistory(db)).smoke;
    assert.equal(history[history.length - 1].baselineQuantity, 8);
  });

  test("deleting a habit removes its history", async () => {
    const db = await freshDb();
    await updateHabitTerms(db, "smoke", NEW, "from_today", { today: "2026-09-15" });
    assert.equal((await loadTermsHistory(db)).smoke.length, 2);
    await deleteSavingsDataForHabit(db, "smoke");
    assert.deepEqual(await loadTermsHistory(db), {});
  });
});

describe("legacy habits", () => {
  test("a habit with a recoverable baseline is measured against exactly that number", async () => {
    const db = openTestDb();
    insertHabit(db, { id: "smoke", baselineQuantity: 6, pricePerItem: 20, createdAt: localNoon("2026-07-01") });
    await migrateAmountLoggedColumn(db);
    await upsertLoggedAmount(db, { id: "a", habitId: "smoke", date: "2026-09-10", amount: 2 });
    await syncSavingsLedger(db, { today: "2026-09-19" });
    const [row] = await loadLedgerRows(db);
    assert.equal(row.baselineQuantity, 6);
    assert.equal(row.baselineCostMinor, 12000);
    assert.equal(row.savedMinor, 8000);
  });

  test("a habit with no stored baseline is unavailable: no records, never guessed, then set explicitly", async () => {
    const db = openTestDb();
    insertHabit(db, { id: "smoke", baselineQuantity: null, pricePerItem: 25, createdAt: localNoon("2026-07-01") });
    await migrateAmountLoggedColumn(db);
    await upsertLoggedAmount(db, { id: "a", habitId: "smoke", date: "2026-09-10", amount: 2 });
    await upsertLoggedAmount(db, { id: "b", habitId: "smoke", date: "2026-09-19", amount: 1 });
    await syncSavingsLedger(db, { today: "2026-09-19" });
    assert.equal((await loadLedgerRows(db)).length, 0, "no record without a baseline");

    const noBaseline = quitHabit({ baselineQuantity: null });
    const before = summaryFrom([noBaseline], await loadLogs(db), [], "2026-09-19");
    assert.equal(before.hasSufficientData, false);
    assert.deepEqual(before.habitsNeedingBaseline, [{ habitId: "smoke", name: "Smoking cigarettes" }]);
    assert.equal(before.potentialSavingsRemainingToday, 0);

    // The person enters their starting amount on the "Baseline and price" screen.
    assert.equal(await updateHabitTerms(db, "smoke", { baselineQuantity: 5, pricePerItem: 25 }, "all_days", { today: "2026-09-19" }), true);
    const rows = await loadLedgerRows(db);
    assert.deepEqual(rows.map((row) => [row.date, row.baselineQuantity, row.savedMinor]).sort(), [
      ["2026-09-10", 5, 7500],
      ["2026-09-19", 5, 10000],
    ]);
  });

  test("month totals come from the ledger for the chosen calendar", async () => {
    const db = await freshDb();
    await upsertLoggedAmount(db, { id: "a", habitId: "smoke", date: "2026-09-10", amount: 1 });
    await upsertLoggedAmount(db, { id: "b", habitId: "smoke", date: "2026-09-18", amount: 1 });
    await syncSavingsLedger(db, { today: "2026-09-19" });
    const ledger = await loadLedgerRows(db);
    const gregorian = sumLedger(ledger, monthRangeFor("2026-09-19", "gregorian")!);
    const bikramSambat = sumLedger(ledger, monthRangeFor("2026-09-19", "bikram_sambat")!);
    assert.equal(gregorian.savedMinor, 15000); // both days are in September
    assert.equal(bikramSambat.savedMinor, 7500); // 10 Sep is in the previous BS month (started 17 Sep)
    assert.equal((await loadLedgerRows(db)).length, 2, "regrouping never touched the records");
  });
});

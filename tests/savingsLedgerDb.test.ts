import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { computeFinancialSummary } from "../lib/financialSummary";
import { upsertLoggedAmount } from "../lib/logWrites";
import { monthRangeFor } from "../lib/monthRange";
import { sumLedger, type LedgerRow } from "../lib/savingsLedger";
import {
  deleteLedgerForHabit,
  loadLedgerRows,
  migrateAmountLoggedColumn,
  SET_BASELINE_SQL,
  syncSavingsLedger,
} from "../lib/savingsLedgerDb";
import type { DailyLog, Habit } from "../lib/types";
import { quitHabit, localNoon } from "./helpers/fixtures";
import { insertHabit, openTestDb, type TestDb } from "./helpers/testDb";

// These run the app's real SQL against an in-memory SQLite database that uses the app's
// real table definitions.

const SEPTEMBER = { start: "2026-09-01", end: "2026-09-30" };

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

    db.raw.prepare("UPDATE habits SET pricePerItem = 30 WHERE id = 'smoke'").run();
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
    await deleteLedgerForHabit(db, "smoke");
    assert.equal((await loadLedgerRows(db)).length, 0);
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

    // The person enters their starting amount (the store runs SET_BASELINE_SQL).
    db.raw.prepare(SET_BASELINE_SQL).run(5, "smoke");
    await syncSavingsLedger(db, { today: "2026-09-19" });
    const rows = await loadLedgerRows(db);
    assert.deepEqual(rows.map((row) => [row.date, row.baselineQuantity, row.savedMinor]).sort(), [
      ["2026-09-10", 5, 7500],
      ["2026-09-19", 5, 10000],
    ]);

    // A baseline that exists is the original setup value and cannot be overwritten this way.
    db.raw.prepare(SET_BASELINE_SQL).run(99, "smoke");
    const stored = db.raw.prepare("SELECT baselineQuantity FROM habits WHERE id = 'smoke'").get() as { baselineQuantity: number };
    assert.equal(stored.baselineQuantity, 5);
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

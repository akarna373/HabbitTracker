import { todayISO } from "./dates";
import {
  localDateOf,
  planLedgerSync,
  type LedgerKey,
  type LedgerLog,
  type LedgerPlan,
  type LedgerRow,
  type SavingsHabit,
} from "./savingsLedger";
import type { TermsEntry } from "./types";

// The database side of the savings ledger (see lib/savingsLedger.ts for the maths
// and the rules). It takes the database as an argument and reads only what it needs
// straight from SQLite, so the same code runs from the store, from a notification
// action with no React tree mounted, and from tests against an in-memory database.

// The few database calls it uses; expo-sqlite's SQLiteDatabase satisfies this.
// (`any[]` params, so expo-sqlite's own union-typed parameters are accepted as-is.)
export interface LedgerDb {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getAllAsync<T>(sql: string, params: any[]): Promise<T[]>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  runAsync(sql: string, params: any[]): Promise<unknown>;
  execAsync(sql: string): Promise<void>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

// One record per habit per local date. The primary key is the uniqueness rule: however
// often the sync runs, a day can exist only once and so can only be credited once.
export const SAVINGS_LEDGER_DDL = `
  CREATE TABLE IF NOT EXISTS daily_savings (
    habitId TEXT NOT NULL,
    date TEXT NOT NULL,
    baselineQuantity REAL NOT NULL,
    unitPriceMinor INTEGER NOT NULL,
    actualQuantity REAL NOT NULL,
    baselineCostMinor INTEGER NOT NULL,
    actualSpendingMinor INTEGER NOT NULL,
    savedMinor INTEGER NOT NULL,
    finalizedAt TEXT,
    updatedAt TEXT NOT NULL,
    PRIMARY KEY (habitId, date)
  );
  CREATE INDEX IF NOT EXISTS idx_daily_savings_date ON daily_savings (date);

  -- Every baseline and price a cost-tracked habit has had, each from the date it began (see
  -- lib/termsHistory.ts). Money maths for a day reads the entry in force on that day.
  CREATE TABLE IF NOT EXISTS habit_terms (
    habitId TEXT NOT NULL,
    effectiveFrom TEXT NOT NULL,
    baselineQuantity REAL,
    pricePerItem REAL,
    PRIMARY KEY (habitId, effectiveFrom)
  );
`;

// Adds daily_logs.amountLogged (see DailyLog in lib/types.ts) once, on the first run
// after the update. Every existing row starts as "logged on purpose" - all of the old
// counter, notification and check-in writes were - except a zero-amount row that also
// carries a reflection or ticked microtasks: those are exactly the rows the app used to
// create as a side effect of saving a reflection or ticking a microtask, so their 0 is
// not a report of zero consumption. Nothing is deleted; those rows just stop counting
// as a clean day for savings. Returns true when the migration ran.
export async function migrateAmountLoggedColumn(db: LedgerDb): Promise<boolean> {
  try {
    await db.execAsync("ALTER TABLE daily_logs ADD COLUMN amountLogged INTEGER NOT NULL DEFAULT 1;");
  } catch (error) {
    if (/duplicate column/i.test(String(error))) return false; // already migrated
    throw error;
  }
  await db.runAsync(
    `UPDATE daily_logs SET amountLogged = 0
     WHERE amount = 0
       AND ((reflection IS NOT NULL AND reflection <> '') OR (microtasksDone IS NOT NULL AND microtasksDone <> '[]'))`,
    []
  );
  return true;
}

export async function loadLedgerRows(db: LedgerDb): Promise<LedgerRow[]> {
  return db.getAllAsync<LedgerRow>(
    `SELECT habitId, date, baselineQuantity, unitPriceMinor, actualQuantity, baselineCostMinor,
            actualSpendingMinor, savedMinor, finalizedAt, updatedAt
     FROM daily_savings`,
    []
  );
}

// Everything the savings feature keeps for a habit that is being deleted.
export async function deleteSavingsDataForHabit(db: LedgerDb, habitId: string): Promise<void> {
  await db.runAsync("DELETE FROM daily_savings WHERE habitId = ?", [habitId]);
  await db.runAsync("DELETE FROM habit_terms WHERE habitId = ?", [habitId]);
}

// Gives every cost-tracked habit that has no history yet its first entry: the baseline and price
// it has now, from the day it was created. Habits from before the history existed have never had
// their terms edited, so what they hold now is what they began with. Safe to repeat.
export async function ensureTermsHistory(db: LedgerDb, habitId?: string): Promise<void> {
  const rows = await db.getAllAsync<{
    id: string;
    createdAt: string;
    baselineQuantity: number | null;
    pricePerItem: number | null;
  }>(
    `SELECT id, createdAt, baselineQuantity, pricePerItem FROM habits
     WHERE hasCost = 1 AND id NOT IN (SELECT habitId FROM habit_terms)${habitId === undefined ? "" : " AND id = ?"}`,
    habitId === undefined ? [] : [habitId]
  );
  for (const row of rows) {
    await db.runAsync(
      "INSERT OR IGNORE INTO habit_terms (habitId, effectiveFrom, baselineQuantity, pricePerItem) VALUES (?,?,?,?)",
      [row.id, localDateOf(row.createdAt) ?? "1970-01-01", row.baselineQuantity, row.pricePerItem]
    );
  }
}

// Each habit's entries, oldest first.
export async function loadTermsHistory(db: LedgerDb, habitId?: string): Promise<Record<string, TermsEntry[]>> {
  const rows = await db.getAllAsync<{
    habitId: string;
    effectiveFrom: string;
    baselineQuantity: number | null;
    pricePerItem: number | null;
  }>(
    `SELECT habitId, effectiveFrom, baselineQuantity, pricePerItem FROM habit_terms${
      habitId === undefined ? "" : " WHERE habitId = ?"
    } ORDER BY effectiveFrom ASC`,
    habitId === undefined ? [] : [habitId]
  );
  const byHabit: Record<string, TermsEntry[]> = {};
  for (const row of rows) {
    (byHabit[row.habitId] ??= []).push({
      effectiveFrom: row.effectiveFrom,
      baselineQuantity: row.baselineQuantity,
      pricePerItem: row.pricePerItem,
    });
  }
  return byHabit;
}

interface HabitRowLite {
  id: string;
  name: string;
  kind: string;
  hasCost: number;
  baselineQuantity: number | null;
  pricePerItem: number | null;
  repeatDays: string;
  frequencyType: string;
  createdAt: string;
  archivedAt: string | null;
}

interface LogRowLite {
  habitId: string;
  date: string;
  amount: number;
  amountLogged: number;
}

function parseRepeatDays(text: string): number[] {
  try {
    const value: unknown = JSON.parse(text);
    return Array.isArray(value) ? value.filter((n): n is number => typeof n === "number") : [];
  } catch {
    return [];
  }
}

async function writePlan(db: LedgerDb, plan: LedgerPlan): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const key of plan.deletes) {
      await db.runAsync("DELETE FROM daily_savings WHERE habitId = ? AND date = ?", [key.habitId, key.date]);
    }
    for (const row of plan.upserts) {
      await db.runAsync(
        `INSERT INTO daily_savings (habitId, date, baselineQuantity, unitPriceMinor, actualQuantity,
                                    baselineCostMinor, actualSpendingMinor, savedMinor, finalizedAt, updatedAt)
         VALUES (?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(habitId, date) DO UPDATE SET
           baselineQuantity = excluded.baselineQuantity,
           unitPriceMinor = excluded.unitPriceMinor,
           actualQuantity = excluded.actualQuantity,
           baselineCostMinor = excluded.baselineCostMinor,
           actualSpendingMinor = excluded.actualSpendingMinor,
           savedMinor = excluded.savedMinor,
           finalizedAt = excluded.finalizedAt,
           updatedAt = excluded.updatedAt`,
        [
          row.habitId,
          row.date,
          row.baselineQuantity,
          row.unitPriceMinor,
          row.actualQuantity,
          row.baselineCostMinor,
          row.actualSpendingMinor,
          row.savedMinor,
          row.finalizedAt,
          row.updatedAt,
        ]
      );
    }
  });
}

async function runSync(db: LedgerDb, today: string, nowISO: string): Promise<LedgerPlan> {
  await ensureTermsHistory(db);
  const historyByHabit = await loadTermsHistory(db);
  const habitRows = await db.getAllAsync<HabitRowLite>(
    `SELECT id, name, kind, hasCost, baselineQuantity, pricePerItem, repeatDays, frequencyType, createdAt, archivedAt
     FROM habits WHERE kind = 'quit' AND hasCost = 1`,
    []
  );
  const habits: SavingsHabit[] = habitRows.map((row) => ({
    id: row.id,
    name: row.name,
    kind: "quit",
    hasCost: true,
    baselineQuantity: row.baselineQuantity,
    pricePerItem: row.pricePerItem,
    termsHistory: historyByHabit[row.id],
    repeatDays: parseRepeatDays(row.repeatDays),
    frequencyType: row.frequencyType as SavingsHabit["frequencyType"],
    createdAt: row.createdAt,
    archivedAt: row.archivedAt,
  }));

  const logRows = await db.getAllAsync<LogRowLite>(
    `SELECT habitId, date, amount, amountLogged FROM daily_logs
     WHERE habitId IN (SELECT id FROM habits WHERE kind = 'quit' AND hasCost = 1)`,
    []
  );
  const logsByHabit: Record<string, LedgerLog[]> = {};
  for (const row of logRows) {
    (logsByHabit[row.habitId] ??= []).push({ date: row.date, amount: row.amount, amountLogged: row.amountLogged !== 0 });
  }

  const existing = await loadLedgerRows(db);
  const plan = planLedgerSync({ habits, logsByHabit, existing, today, nowISO });
  if (plan.upserts.length > 0 || plan.deletes.length > 0) await writePlan(db, plan);
  return plan;
}

// Which days a change of baseline or price applies to.
//  - "from_today": the price or baseline really changed. It is added to the habit's history as a
//    new entry starting today. Every earlier day keeps the terms it had - in the dashboard, the
//    weekly estimates, the targets and the streak.
//  - "all_days": the setup values were a mistake. The history is replaced by a single entry from the
//    day the habit was created, and every logged day is recalculated.
export type TermsChangeScope = "from_today" | "all_days";

// Saves a new baseline and price for a cost-tracked quit habit and brings the ledger in line.
// Returns false, changing nothing, when the values are not usable or the habit is not a
// cost-tracked quit habit. Also how a habit that never had a baseline gets one.
export async function updateHabitTerms(
  db: LedgerDb,
  habitId: string,
  terms: { baselineQuantity: number; pricePerItem: number },
  scope: TermsChangeScope,
  options: { today?: string; nowISO?: string } = {}
): Promise<boolean> {
  const { baselineQuantity, pricePerItem } = terms;
  if (!Number.isFinite(baselineQuantity) || baselineQuantity <= 0) return false;
  if (!Number.isFinite(pricePerItem) || pricePerItem < 0) return false;
  const today = options.today ?? todayISO();

  const insertEntry =
    "INSERT INTO habit_terms (habitId, effectiveFrom, baselineQuantity, pricePerItem) VALUES (?,?,?,?)";

  let changed = false;
  await db.withTransactionAsync(async () => {
    // Record the terms being replaced first. Without an entry for them, the days before this
    // change would fall back to the NEW values.
    await ensureTermsHistory(db, habitId);

    const result = (await db.runAsync(
      "UPDATE habits SET baselineQuantity = ?, pricePerItem = ? WHERE id = ? AND kind = 'quit' AND hasCost = 1",
      [baselineQuantity, pricePerItem, habitId]
    )) as { changes?: number | bigint } | undefined;
    changed = Number(result?.changes ?? 0) > 0;
    if (!changed) return;

    if (scope === "all_days") {
      const [habit] = await db.getAllAsync<{ createdAt: string }>("SELECT createdAt FROM habits WHERE id = ?", [habitId]);
      await db.runAsync("DELETE FROM habit_terms WHERE habitId = ?", [habitId]);
      await db.runAsync(insertEntry, [habitId, (habit && localDateOf(habit.createdAt)) ?? today, baselineQuantity, pricePerItem]);
      // Dropping the records lets the sync below rebuild every day from the logs with the new terms.
      await db.runAsync("DELETE FROM daily_savings WHERE habitId = ?", [habitId]);
    } else {
      await db.runAsync(
        `${insertEntry}
         ON CONFLICT(habitId, effectiveFrom) DO UPDATE SET
           baselineQuantity = excluded.baselineQuantity, pricePerItem = excluded.pricePerItem`,
        [habitId, today, baselineQuantity, pricePerItem]
      );
    }
  });
  if (changed) await syncSavingsLedger(db, options);
  return changed;
}

// Runs one at a time in this JS runtime, so two triggers close together (a tap and a
// resume, say) can never interleave their reads and writes.
let queue: Promise<unknown> = Promise.resolve();

// Brings the ledger in line with the logs and finalizes every day before `today`.
// Safe to call as often as you like: it recomputes from the logs and writes only what
// changed, so calling it twice in a row changes nothing the second time, and a day
// that ended while the app was closed is finalized by the next call.
export function syncSavingsLedger(
  db: LedgerDb,
  options: { today?: string; nowISO?: string } = {}
): Promise<LedgerPlan> {
  const today = options.today ?? todayISO();
  const nowISO = options.nowISO ?? new Date().toISOString();
  const run = queue.then(() => runSync(db, today, nowISO));
  queue = run.catch(() => undefined);
  return run;
}

export type { LedgerKey };

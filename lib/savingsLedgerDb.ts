import { todayISO } from "./dates";
import {
  planLedgerSync,
  type LedgerKey,
  type LedgerLog,
  type LedgerPlan,
  type LedgerRow,
  type SavingsHabit,
} from "./savingsLedger";

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

// Fills in a baseline that was never stored. The WHERE clause is what protects the
// original setup value: a habit that already has one is never overwritten.
export const SET_BASELINE_SQL =
  "UPDATE habits SET baselineQuantity = ? WHERE id = ? AND (baselineQuantity IS NULL OR baselineQuantity <= 0)";

export async function loadLedgerRows(db: LedgerDb): Promise<LedgerRow[]> {
  return db.getAllAsync<LedgerRow>(
    `SELECT habitId, date, baselineQuantity, unitPriceMinor, actualQuantity, baselineCostMinor,
            actualSpendingMinor, savedMinor, finalizedAt, updatedAt
     FROM daily_savings`,
    []
  );
}

export async function deleteLedgerForHabit(db: LedgerDb, habitId: string): Promise<void> {
  await db.runAsync("DELETE FROM daily_savings WHERE habitId = ?", [habitId]);
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

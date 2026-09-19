import { isoDate } from "./dates";
import { isHabitScheduledOn, isRealISODate } from "./habitSchedule";
import type { MonthRange } from "./monthRange";
import type { DailyLog, Habit } from "./types";

// The daily savings ledger: one record per cost-tracked quit habit per local
// calendar date. Pure maths and planning only - no React, no store, no clock, no
// database (lib/savingsLedgerDb.ts runs the plan against SQLite).
//
// Every day is measured against the ORIGINAL baseline the habit was set up with:
//
//   baselineDailyCost = baselineQuantity x unitPrice
//   actualSpending    = loggedQuantity   x unitPrice
//   dailySaved        = max(0, baselineDailyCost - actualSpending)
//
// Money is kept in integer minor units (x100) so sums never drift. A day is
// provisional until the local date rolls over, then final. Monthly totals are always
// summed from the daily records - there is no running total that could be credited
// twice.

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

export const MINOR_PER_MAJOR = 100;

export function toMinor(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round((amount + Number.EPSILON) * MINOR_PER_MAJOR);
}

export function fromMinor(minor: number): number {
  const value = minor / MINOR_PER_MAJOR;
  return value === 0 ? 0 : value; // never -0
}

// quantity x unit price, in whole minor units.
export function costMinor(quantity: number, unitPriceMinor: number): number {
  return Math.round(quantity * unitPriceMinor);
}

export interface DayAmounts {
  baselineCostMinor: number;
  actualSpendingMinor: number;
  savedMinor: number;
}

// The three figures for one day. Spending above the baseline stays fully in
// actualSpendingMinor; the saving just stops at 0.
export function computeAmounts(baselineQuantity: number, unitPriceMinor: number, actualQuantity: number): DayAmounts {
  const baselineCostMinor = costMinor(baselineQuantity, unitPriceMinor);
  const actualSpendingMinor = costMinor(actualQuantity, unitPriceMinor);
  return { baselineCostMinor, actualSpendingMinor, savedMinor: Math.max(0, baselineCostMinor - actualSpendingMinor) };
}

// ---------------------------------------------------------------------------
// Which habits count, and on what terms
// ---------------------------------------------------------------------------

// The slice of a habit the ledger needs. The database layer selects just these
// columns, so it also works in the headless notification runtime.
export type SavingsHabit = Pick<
  Habit,
  "id" | "name" | "kind" | "hasCost" | "baselineQuantity" | "pricePerItem" | "repeatDays" | "frequencyType" | "createdAt" | "archivedAt"
>;

function isPositiveFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isNonNegativeFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

// The baseline stored when the habit was set up. It is never derived from price, from
// today's target or from what was logged; if it was not stored it is simply missing.
export function hasRecoverableBaseline(habit: Pick<Habit, "baselineQuantity">): boolean {
  return isPositiveFinite(habit.baselineQuantity);
}

// A cost-tracked quit habit whose original baseline cannot be recovered: the person
// has to set one before it can count toward savings.
export function needsBaseline(habit: Pick<Habit, "kind" | "hasCost" | "baselineQuantity">): boolean {
  return habit.kind === "quit" && habit.hasCost === true && !hasRecoverableBaseline(habit);
}

export interface SavingsTerms {
  baselineQuantity: number;
  unitPriceMinor: number;
}

// The money terms of a habit, or null when it cannot take part in savings: it must be
// a cost-tracked quit habit with a stored positive baseline and a non-negative price
// (a free item is fine).
export function getSavingsTerms(habit: Pick<Habit, "kind" | "hasCost" | "baselineQuantity" | "pricePerItem">): SavingsTerms | null {
  if (habit.kind !== "quit" || habit.hasCost !== true) return null;
  const { baselineQuantity, pricePerItem } = habit;
  if (!isPositiveFinite(baselineQuantity) || !isNonNegativeFinite(pricePerItem)) return null;
  const unitPriceMinor = toMinor(pricePerItem);
  if (!Number.isFinite(costMinor(baselineQuantity, unitPriceMinor))) return null;
  return { baselineQuantity, unitPriceMinor };
}

// The part of a daily log the ledger reads.
export type LedgerLog = Pick<DailyLog, "date" | "amount" | "amountLogged">;

// A log the ledger may use: an amount that was recorded on purpose. A row that only
// exists because a microtask was ticked or a reflection saved is not consumption
// data, and neither is a broken amount.
export function isUsableLog(log: Pick<DailyLog, "amount" | "amountLogged">): boolean {
  return log.amountLogged === true && isNonNegativeFinite(log.amount);
}

// createdAt is a UTC ISO string but every other date is the device's local date, so it
// is converted, not sliced. Unparseable -> null (no lower bound).
export function localDateOf(isoDateTime: string): string | null {
  const parsed = new Date(isoDateTime);
  return Number.isNaN(parsed.getTime()) ? null : isoDate(parsed);
}

// ---------------------------------------------------------------------------
// The ledger record and its planner
// ---------------------------------------------------------------------------

export interface LedgerRow {
  habitId: string;
  date: string; // local date, "YYYY-MM-DD"
  // The terms this day was measured with. Kept once the day is final, so a later
  // price or baseline change only affects days that come after.
  baselineQuantity: number;
  unitPriceMinor: number;
  actualQuantity: number;
  baselineCostMinor: number;
  actualSpendingMinor: number;
  savedMinor: number;
  finalizedAt: string | null; // null while the day is still provisional
  updatedAt: string;
}

export interface LedgerKey {
  habitId: string;
  date: string;
}

export interface LedgerPlan {
  upserts: LedgerRow[];
  deletes: LedgerKey[];
}

export interface LedgerPlanInput {
  habits: readonly SavingsHabit[]; // active and archived
  logsByHabit: Readonly<Record<string, readonly LedgerLog[] | undefined>>;
  existing: readonly LedgerRow[];
  today: string; // local "YYYY-MM-DD"
  nowISO: string;
}

function rowKey(habitId: string, date: string): string {
  return `${habitId}|${date}`;
}

function sameContent(a: LedgerRow, b: LedgerRow): boolean {
  return (
    a.baselineQuantity === b.baselineQuantity &&
    a.unitPriceMinor === b.unitPriceMinor &&
    a.actualQuantity === b.actualQuantity &&
    a.baselineCostMinor === b.baselineCostMinor &&
    a.actualSpendingMinor === b.actualSpendingMinor &&
    a.savedMinor === b.savedMinor &&
    a.finalizedAt === b.finalizedAt
  );
}

// Works out what the ledger should contain and how it differs from what it has. It
// is a full recomputation from the logs, never an increment, so running it again on
// its own result plans nothing (idempotent) and an edited or deleted log simply
// changes or removes that day's record.
//
// - A day gets a record only from a usable log on a day the habit was active: on or
//   after the day it was created, not after it was archived, not in the future, and on
//   a scheduled day. No log means unknown, so no record and no saving.
// - A record for a day before `today` is final (stamped once); today's stays provisional.
// - A final record keeps the baseline and price it was measured with. Only its logged
//   quantity follows an edited log. A provisional record follows the habit's current terms.
// - A habit with no usable terms (missing baseline) is skipped entirely and its existing
//   records are left alone.
export function planLedgerSync(input: LedgerPlanInput): LedgerPlan {
  const { habits, logsByHabit, existing, today, nowISO } = input;
  const upserts: LedgerRow[] = [];
  const deletes: LedgerKey[] = [];
  if (!isRealISODate(today)) return { upserts, deletes };

  const existingByKey = new Map<string, LedgerRow>();
  const existingByHabit = new Map<string, LedgerRow[]>();
  for (const row of existing) {
    existingByKey.set(rowKey(row.habitId, row.date), row);
    const list = existingByHabit.get(row.habitId);
    if (list) list.push(row);
    else existingByHabit.set(row.habitId, [row]);
  }

  for (const habit of habits) {
    const terms = getSavingsTerms(habit);
    if (!terms) continue;

    const created = localDateOf(habit.createdAt);
    const archivedOn = habit.archivedAt ? localDateOf(habit.archivedAt) : null;
    const lastDay = archivedOn !== null && archivedOn < today ? archivedOn : today;

    const quantityByDate = new Map<string, number>();
    for (const log of logsByHabit[habit.id] ?? []) {
      if (!isUsableLog(log) || !isRealISODate(log.date)) continue;
      if (created !== null && log.date < created) continue;
      if (log.date > lastDay) continue;
      if (!isHabitScheduledOn(habit, log.date)) continue;
      quantityByDate.set(log.date, log.amount);
    }

    for (const [date, quantity] of quantityByDate) {
      const previous = existingByKey.get(rowKey(habit.id, date));
      const isFinal = previous?.finalizedAt != null;
      const measuredWith =
        previous && isFinal
          ? { baselineQuantity: previous.baselineQuantity, unitPriceMinor: previous.unitPriceMinor }
          : terms;
      const amounts = computeAmounts(measuredWith.baselineQuantity, measuredWith.unitPriceMinor, quantity);
      const next: LedgerRow = {
        habitId: habit.id,
        date,
        baselineQuantity: measuredWith.baselineQuantity,
        unitPriceMinor: measuredWith.unitPriceMinor,
        actualQuantity: quantity,
        ...amounts,
        finalizedAt: previous?.finalizedAt ?? (date < today ? nowISO : null),
        updatedAt: nowISO,
      };
      if (!previous || !sameContent(previous, next)) upserts.push(next);
    }

    for (const row of existingByHabit.get(habit.id) ?? []) {
      if (!quantityByDate.has(row.date)) deletes.push({ habitId: row.habitId, date: row.date });
    }
  }

  return { upserts, deletes };
}

// Applies a plan to a list of rows in memory - what the database layer does in SQL.
// Used by tests and by anything that needs the resulting ledger without a database.
export function applyLedgerPlan(rows: readonly LedgerRow[], plan: LedgerPlan): LedgerRow[] {
  const byKey = new Map<string, LedgerRow>();
  for (const row of rows) byKey.set(rowKey(row.habitId, row.date), row);
  for (const key of plan.deletes) byKey.delete(rowKey(key.habitId, key.date));
  for (const row of plan.upserts) byKey.set(rowKey(row.habitId, row.date), row);
  return [...byKey.values()];
}

// ---------------------------------------------------------------------------
// Totals
// ---------------------------------------------------------------------------

export interface LedgerTotals {
  // Only final days count as saved: a saving is earned when its day is over.
  savedMinor: number;
  // Every record in the range, final or not - spending is a fact, not a credit.
  spentMinor: number;
  loggedDays: number;
  cleanDays: number;
}

// Adds up the daily records whose date falls inside `range`. `excludeDate` leaves one
// day out (the dashboard adds today from the live logs instead of the record).
export function sumLedger(
  rows: readonly LedgerRow[],
  range: MonthRange,
  options: { habitId?: string; excludeDate?: string } = {}
): LedgerTotals {
  let savedMinor = 0;
  let spentMinor = 0;
  let loggedDays = 0;
  let cleanDays = 0;
  for (const row of rows) {
    if (row.date < range.start || row.date > range.end) continue;
    if (options.habitId !== undefined && row.habitId !== options.habitId) continue;
    if (options.excludeDate !== undefined && row.date === options.excludeDate) continue;
    spentMinor += row.actualSpendingMinor;
    loggedDays += 1;
    if (row.actualQuantity === 0) cleanDays += 1;
    if (row.finalizedAt !== null) savedMinor += row.savedMinor;
  }
  return { savedMinor, spentMinor, loggedDays, cleanDays };
}

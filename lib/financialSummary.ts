import { isoDate, weekdayIndexMonFirst } from "./dates";
import { isValidMonthlyGoal } from "./financialSettings";
import type { DailyLog, Habit } from "./types";

// Pure money maths for the "Today's Summary" dashboard. No React, no store, no
// clock: the caller passes "today" (a local "YYYY-MM-DD"), so the same inputs
// always give the same answer. Nothing here is ever written to the database -
// every figure is derived on demand from the habits and their daily logs.
//
// Per eligible habit and per day:
//   normal daily cost   = baselineQuantity x pricePerItem
//   actual expenditure  = logged amount    x pricePerItem
//   confirmed saving    = max(normal daily cost - actual expenditure, 0)
//
// A saving is only ever *confirmed* by an explicit log for that day. A day with
// no log is unknown, not zero consumption - it adds nothing to spending or to
// confirmed savings. A logged amount of 0 is a confirmed clean day and earns the
// full normal daily cost.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isRealISODate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

function isPositiveFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isNonNegativeFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

// Whole cents, never -0 or NaN, so float noise (0.1 + 0.2) can't reach the UI.
function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return rounded === 0 ? 0 : rounded;
}

export interface FinancialTerms {
  baselineQuantity: number;
  pricePerItem: number;
  normalDailyCost: number;
}

// The habit's money terms, or null when it can't be part of the financial
// summary: it must be cost-enabled with a positive baseline quantity and a
// non-negative price (a free item is fine, a negative or missing price is not).
export function getFinancialTerms(
  habit: Pick<Habit, "hasCost" | "baselineQuantity" | "pricePerItem">
): FinancialTerms | null {
  if (habit.hasCost !== true) return null;
  const { baselineQuantity, pricePerItem } = habit;
  if (!isPositiveFinite(baselineQuantity) || !isNonNegativeFinite(pricePerItem)) return null;
  const normalDailyCost = baselineQuantity * pricePerItem;
  if (!Number.isFinite(normalDailyCost)) return null;
  return { baselineQuantity, pricePerItem, normalDailyCost };
}

// repeatDays is Monday-first (0=Mon..6=Sun), same convention as lib/dates.ts.
export function isHabitScheduledOn(habit: Pick<Habit, "repeatDays" | "frequencyType">, date: string): boolean {
  if (!isRealISODate(date)) return false;
  if (!Array.isArray(habit.repeatDays)) return habit.frequencyType === "daily";
  return habit.repeatDays.includes(weekdayIndexMonFirst(date));
}

// createdAt is a UTC ISO string but every other date in the app is the device's
// local date, so it is converted rather than sliced (slicing puts a habit
// created late evening or early morning on the wrong local day). A missing or
// unparseable value returns null, meaning "no lower bound".
function createdLocalDate(createdAt: string): string | null {
  const created = new Date(createdAt);
  return Number.isNaN(created.getTime()) ? null : isoDate(created);
}

// Amounts that can be trusted: finite and not negative. Anything else is treated
// as if the log did not exist, so it can neither cost nor save anything.
function validAmount(log: DailyLog): number | null {
  return isNonNegativeFinite(log.amount) ? log.amount : null;
}

export interface HabitFinancialBreakdown {
  habitId: string;
  name: string;
  normalDailyCost: number;
  scheduledToday: boolean;
  // A usable log exists for today (only ever true on a scheduled day).
  hasLogToday: boolean;
  // Ceiling for today: the normal daily cost when scheduled today, else 0.
  potentialSavingsToday: number;
  spentToday: number;
  confirmedSavingsToday: number;
  spentThisMonth: number;
  savedThisMonth: number;
  // Scheduled days this month (creation day onwards, up to today) with a usable log.
  loggedDaysThisMonth: number;
  // Of those, days that were logged as exactly 0.
  cleanDaysThisMonth: number;
}

export interface FinancialSummary {
  // True when at least one habit has the money terms above. False means the
  // dashboard should ask for a baseline and price instead of showing zeros.
  hasSufficientData: boolean;
  eligibleHabitCount: number;
  today: string;
  monthStart: string;
  potentialSavingsToday: number;
  spentToday: number;
  confirmedSavingsToday: number;
  spentThisMonth: number;
  savedThisMonth: number;
  habits: HabitFinancialBreakdown[];
}

export interface FinancialSummaryInput {
  habits: readonly Habit[];
  logsByHabit: Readonly<Record<string, readonly DailyLog[] | undefined>>;
  // Local calendar date, "YYYY-MM-DD". The summary covers the calendar month
  // that contains it, up to and including this day.
  today: string;
}

function emptySummary(today: string, monthStart: string): FinancialSummary {
  return {
    hasSufficientData: false,
    eligibleHabitCount: 0,
    today,
    monthStart,
    potentialSavingsToday: 0,
    spentToday: 0,
    confirmedSavingsToday: 0,
    spentThisMonth: 0,
    savedThisMonth: 0,
    habits: [],
  };
}

export function computeFinancialSummary(input: FinancialSummaryInput): FinancialSummary {
  const { habits, logsByHabit, today } = input;
  if (!isRealISODate(today)) return emptySummary("", "");
  const monthStart = `${today.slice(0, 7)}-01`;

  const breakdowns: HabitFinancialBreakdown[] = [];

  for (const habit of habits) {
    if (habit.archivedAt) continue;
    const terms = getFinancialTerms(habit);
    if (!terms) continue;

    // Nothing before the habit existed, nor before this month, counts.
    const createdDate = createdLocalDate(habit.createdAt);
    const windowStart = createdDate !== null && createdDate > monthStart ? createdDate : monthStart;

    const scheduledToday = today >= windowStart && isHabitScheduledOn(habit, today);

    let spentToday = 0;
    let savedToday = 0;
    let hasLogToday = false;
    let spentMonth = 0;
    let savedMonth = 0;
    let loggedDays = 0;
    let cleanDays = 0;

    // Only explicit logs produce spending or savings, so walking the logs (not
    // every calendar day) is enough - and a day without one is simply unknown.
    for (const log of logsByHabit[habit.id] ?? []) {
      if (!isRealISODate(log.date) || log.date < windowStart || log.date > today) continue;
      if (!isHabitScheduledOn(habit, log.date)) continue;
      const amount = validAmount(log);
      if (amount === null) continue;

      const spent = amount * terms.pricePerItem;
      // Spending above the baseline stays fully counted; the saving just stops at 0.
      const saved = Math.max(terms.normalDailyCost - spent, 0);

      spentMonth += spent;
      savedMonth += saved;
      loggedDays += 1;
      if (amount === 0) cleanDays += 1;

      if (log.date === today) {
        hasLogToday = true;
        spentToday += spent;
        savedToday += saved;
      }
    }

    breakdowns.push({
      habitId: habit.id,
      name: habit.name,
      normalDailyCost: roundMoney(terms.normalDailyCost),
      scheduledToday,
      hasLogToday,
      potentialSavingsToday: scheduledToday ? roundMoney(terms.normalDailyCost) : 0,
      spentToday: roundMoney(spentToday),
      confirmedSavingsToday: roundMoney(savedToday),
      spentThisMonth: roundMoney(spentMonth),
      savedThisMonth: roundMoney(savedMonth),
      loggedDaysThisMonth: loggedDays,
      cleanDaysThisMonth: cleanDays,
    });
  }

  if (breakdowns.length === 0) return emptySummary(today, monthStart);

  // Totals add the already-rounded per-habit figures, so the breakdown always
  // sums to the headline number exactly.
  const sum = (pick: (b: HabitFinancialBreakdown) => number) =>
    roundMoney(breakdowns.reduce((total, b) => total + pick(b), 0));

  return {
    hasSufficientData: true,
    eligibleHabitCount: breakdowns.length,
    today,
    monthStart,
    potentialSavingsToday: sum((b) => b.potentialSavingsToday),
    spentToday: sum((b) => b.spentToday),
    confirmedSavingsToday: sum((b) => b.confirmedSavingsToday),
    spentThisMonth: sum((b) => b.spentThisMonth),
    savedThisMonth: sum((b) => b.savedThisMonth),
    habits: breakdowns,
  };
}

export interface GoalProgress {
  goal: number;
  saved: number;
  // min(saved / goal x 100, 100) - exact, for drawing the bar.
  percent: number;
  // Whole percent for text: rounded down, so "100%" only ever appears once the
  // goal is really met (99.7% reads as 99%, not 100%).
  displayPercent: number;
  completed: boolean;
  // How much is still needed, or how far past the goal the month already is.
  remaining: number;
  exceededBy: number;
}

// Progress toward the monthly savings goal, or null when there is no valid goal
// (none set, zero, negative, not a number) so callers can simply skip the UI.
export function computeGoalProgress(
  savedThisMonth: number,
  monthlyGoal: number | null | undefined
): GoalProgress | null {
  if (!isValidMonthlyGoal(monthlyGoal)) return null;
  const saved = Number.isFinite(savedThisMonth) && savedThisMonth > 0 ? savedThisMonth : 0;
  const percent = Math.min((saved / monthlyGoal) * 100, 100);
  const completed = saved >= monthlyGoal;
  return {
    goal: monthlyGoal,
    saved: roundMoney(saved),
    percent,
    displayPercent: completed ? 100 : Math.floor(percent),
    completed,
    remaining: roundMoney(Math.max(monthlyGoal - saved, 0)),
    exceededBy: roundMoney(Math.max(saved - monthlyGoal, 0)),
  };
}

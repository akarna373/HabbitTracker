import type { CalendarType } from "./calendarSettings";
import { isValidMonthlyGoal } from "./financialSettings";
import { isHabitScheduledOn } from "./habitSchedule";
import { monthRangeFor } from "./monthRange";
import {
  computeAmounts,
  fromMinor,
  getSavingsTerms,
  isUsableLog,
  localDateOf,
  needsBaseline,
  sumLedger,
  type LedgerRow,
} from "./savingsLedger";
import type { DailyLog, Habit } from "./types";

// Pure money maths for the "Today's Summary" dashboard. No React, no store, no
// clock: the caller passes "today" (a local "YYYY-MM-DD"), so the same inputs always
// give the same answer. The daily records themselves live in the savings ledger
// (lib/savingsLedger.ts); this file combines them with today's live logs.
//
// Per eligible habit (an active, cost-tracked quit habit with its ORIGINAL baseline):
//
//   baseline daily cost   = baselineQuantity x unitPrice
//   today's spending      = quantity logged today x unitPrice
//   potential remaining   = max(0, baseline daily cost - today's spending)   [live]
//   saved today           = same figure, but only once today is logged       [provisional]
//   saved this month      = sum of the FINAL daily records in the month      [ledger]
//   spent this month      = the month's daily records plus today's live spend
//
// A saving needs a log recorded on purpose; a day with no log is unknown and adds
// nothing. "Saved" is earned when its day is over, which is why the month total counts
// only final days while today shows as provisional. The month is the calendar month
// (Gregorian or Bikram Sambat) the person chose.

export { isHabitScheduledOn };

// Whole cents, never -0 or NaN, so float noise (0.1 + 0.2) can't reach the UI.
function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return rounded === 0 ? 0 : rounded;
}

export interface HabitFinancialBreakdown {
  habitId: string;
  name: string;
  archived: boolean;
  // baselineQuantity x unitPrice
  normalDailyCost: number;
  scheduledToday: boolean;
  // A usable log exists for today (only ever true on a scheduled day).
  hasLogToday: boolean;
  // What is still there to save today (0 once the day's spending reaches the baseline).
  potentialSavingsRemainingToday: number;
  spentToday: number;
  // Provisional: becomes final when the day is over.
  savedToday: number;
  spentThisMonth: number;
  // Final days only.
  savedThisMonth: number;
  // Days this month with a record, and how many of them were exactly 0.
  loggedDaysThisMonth: number;
  cleanDaysThisMonth: number;
}

export interface FinancialSummary {
  // True when at least one active habit has the money terms above. False means the
  // dashboard should ask for a baseline and price instead of showing zeros.
  hasSufficientData: boolean;
  eligibleHabitCount: number;
  today: string;
  monthStart: string;
  monthEnd: string;
  potentialSavingsRemainingToday: number;
  spentToday: number;
  savedToday: number; // provisional
  spentThisMonth: number;
  savedThisMonth: number; // final days only
  // Cost-tracked quit habits whose original baseline cannot be recovered; they add
  // nothing until the person sets one.
  habitsNeedingBaseline: { habitId: string; name: string }[];
  habits: HabitFinancialBreakdown[];
}

export interface FinancialSummaryInput {
  habits: readonly Habit[]; // active
  archivedHabits?: readonly Habit[];
  logsByHabit: Readonly<Record<string, readonly DailyLog[] | undefined>>;
  ledger: readonly LedgerRow[];
  // Local calendar date, "YYYY-MM-DD".
  today: string;
  // Decides where "this month" starts and ends.
  calendarType: CalendarType;
}

function emptySummary(today: string, monthStart: string, monthEnd: string): FinancialSummary {
  return {
    hasSufficientData: false,
    eligibleHabitCount: 0,
    today,
    monthStart,
    monthEnd,
    potentialSavingsRemainingToday: 0,
    spentToday: 0,
    savedToday: 0,
    spentThisMonth: 0,
    savedThisMonth: 0,
    habitsNeedingBaseline: [],
    habits: [],
  };
}

export function computeFinancialSummary(input: FinancialSummaryInput): FinancialSummary {
  const { habits, archivedHabits = [], logsByHabit, ledger, today, calendarType } = input;
  const range = monthRangeFor(today, calendarType);
  if (range === null) return emptySummary("", "", "");

  const breakdowns: HabitFinancialBreakdown[] = [];
  const habitsNeedingBaseline: { habitId: string; name: string }[] = [];
  let potentialMinor = 0;
  let spentTodayMinor = 0;
  let savedTodayMinor = 0;
  let spentMonthMinor = 0;
  let savedMonthMinor = 0;

  for (const habit of habits) {
    if (habit.archivedAt) continue;
    if (needsBaseline(habit)) {
      habitsNeedingBaseline.push({ habitId: habit.id, name: habit.name });
      continue;
    }
    const terms = getSavingsTerms(habit);
    if (!terms) continue;

    const created = localDateOf(habit.createdAt);
    const scheduledToday = (created === null || today >= created) && isHabitScheduledOn(habit, today);
    const todayLog = (logsByHabit[habit.id] ?? []).find((log) => log.date === today);
    const usableToday = scheduledToday && todayLog !== undefined && isUsableLog(todayLog);

    // Today is worked out from the live log so it moves the instant the count does;
    // the ledger holds every other day.
    const quantityToday = todayLog !== undefined && Number.isFinite(todayLog.amount) && todayLog.amount >= 0 ? todayLog.amount : 0;
    const remaining = computeAmounts(terms.baselineQuantity, terms.unitPriceMinor, quantityToday);
    const potential = scheduledToday ? remaining.savedMinor : 0;
    const spentToday = usableToday ? remaining.actualSpendingMinor : 0;
    const savedToday = usableToday ? remaining.savedMinor : 0;

    const past = sumLedger(ledger, range, { habitId: habit.id, excludeDate: today });
    const spentMonth = past.spentMinor + spentToday;
    const loggedDays = past.loggedDays + (usableToday ? 1 : 0);
    const cleanDays = past.cleanDays + (usableToday && quantityToday === 0 ? 1 : 0);

    potentialMinor += potential;
    spentTodayMinor += spentToday;
    savedTodayMinor += savedToday;
    spentMonthMinor += spentMonth;
    savedMonthMinor += past.savedMinor;

    breakdowns.push({
      habitId: habit.id,
      name: habit.name,
      archived: false,
      normalDailyCost: fromMinor(remaining.baselineCostMinor),
      scheduledToday,
      hasLogToday: usableToday,
      potentialSavingsRemainingToday: fromMinor(potential),
      spentToday: fromMinor(spentToday),
      savedToday: fromMinor(savedToday),
      spentThisMonth: fromMinor(spentMonth),
      savedThisMonth: fromMinor(past.savedMinor),
      loggedDaysThisMonth: loggedDays,
      cleanDaysThisMonth: cleanDays,
    });
  }
  const eligibleHabitCount = breakdowns.length;

  // A habit archived partway through the month keeps what it already earned: those
  // days really happened. It adds nothing new (its ledger stops at the archive date).
  for (const habit of archivedHabits) {
    const totals = sumLedger(ledger, range, { habitId: habit.id });
    if (totals.loggedDays === 0) continue;
    spentMonthMinor += totals.spentMinor;
    savedMonthMinor += totals.savedMinor;
    breakdowns.push({
      habitId: habit.id,
      name: habit.name,
      archived: true,
      normalDailyCost: 0,
      scheduledToday: false,
      hasLogToday: false,
      potentialSavingsRemainingToday: 0,
      spentToday: 0,
      savedToday: 0,
      spentThisMonth: fromMinor(totals.spentMinor),
      savedThisMonth: fromMinor(totals.savedMinor),
      loggedDaysThisMonth: totals.loggedDays,
      cleanDaysThisMonth: totals.cleanDays,
    });
  }

  if (eligibleHabitCount === 0 && habitsNeedingBaseline.length === 0 && breakdowns.length === 0) {
    return emptySummary(today, range.start, range.end);
  }

  return {
    hasSufficientData: eligibleHabitCount > 0,
    eligibleHabitCount,
    today,
    monthStart: range.start,
    monthEnd: range.end,
    potentialSavingsRemainingToday: fromMinor(potentialMinor),
    spentToday: fromMinor(spentTodayMinor),
    savedToday: fromMinor(savedTodayMinor),
    spentThisMonth: fromMinor(spentMonthMinor),
    savedThisMonth: fromMinor(savedMonthMinor),
    habitsNeedingBaseline,
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

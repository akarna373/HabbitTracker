import { addDays, daysBetween, last7Days, last7DaysEndingDaysAgo, todayISO } from "./dates";
import type { DailyLog, Habit } from "./types";

export function selectLogForDate(logs: DailyLog[] | undefined, date: string): DailyLog | undefined {
  return logs?.find((l) => l.date === date);
}

export function selectTodayLog(logs: DailyLog[] | undefined): DailyLog | undefined {
  return selectLogForDate(logs, todayISO());
}

export function formatTime12h(time: string | null): string {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

export function isHabitCompleteOn(habit: Habit, logs: DailyLog[] | undefined, date: string): boolean {
  const log = selectLogForDate(logs, date);
  if (habit.kind === "quit") {
    if (!log) return false;
    if (habit.goalType === "reduce") return log.amount <= reduceDailyTargetForDate(habit, date);
    if (habit.goalType === "quit_completely") return log.amount === 0;
    // track_only, or a non-cost quit habit with no goalType - any logged day counts.
    return true;
  }
  if (habit.trackingMethod === "checkin") return (log?.amount ?? 0) >= 1;
  return (log?.amount ?? 0) >= (habit.targetAmount ?? Infinity);
}

export function costForAmount(habit: Habit, amount: number): number {
  if (!habit.hasCost || !habit.pricePerItem) return 0;
  return amount * habit.pricePerItem;
}

export function baselineCost(habit: Habit): number {
  if (!habit.hasCost || !habit.pricePerItem || !habit.baselineQuantity) return 0;
  return habit.baselineQuantity * habit.pricePerItem;
}

// "Reduce, then reach zero": a 14-day cycle anchored on the habit's own
// createdAt (no extra column needed) - day 1 is creation day, the daily
// target declines linearly to 0 by day 14, and stays at 0 after (maintenance).
export const REDUCE_CYCLE_DAYS = 14;

export function reduceCycleDayForDate(habit: Habit, date: string): number {
  const createdDate = habit.createdAt.slice(0, 10);
  return daysBetween(createdDate, date) + 1;
}

export function reduceCycleDay(habit: Habit): number {
  return reduceCycleDayForDate(habit, todayISO());
}

export function reduceDailyTargetForDate(habit: Habit, date: string): number {
  if (!habit.baselineQuantity) return 0;
  const cycleDays = habit.reduceDays ?? REDUCE_CYCLE_DAYS;
  const day = Math.max(1, reduceCycleDayForDate(habit, date));
  if (day >= cycleDays || cycleDays <= 1) return 0;
  return Math.round((habit.baselineQuantity * (cycleDays - day)) / (cycleDays - 1));
}

export function reduceDailyTarget(habit: Habit): number {
  return reduceDailyTargetForDate(habit, todayISO());
}

// Consecutive days ending today (or yesterday, if today has no entry yet) where the habit was completed.
export function computeStreak(habit: Habit, logs: DailyLog[] | undefined): number {
  let cursor = todayISO();
  if (!isHabitCompleteOn(habit, logs, cursor)) {
    cursor = addDays(cursor, -1);
  }
  let streak = 0;
  while (isHabitCompleteOn(habit, logs, cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function weeklyCompletion(habits: Habit[], logsByHabit: Record<string, DailyLog[]>, weeksAgo = 0) {
  const days = weeksAgo === 0 ? last7Days() : last7DaysEndingDaysAgo(weeksAgo * 7);
  let completed = 0;
  let total = 0;
  const perDay = days.map((date) => {
    let dayCompleted = 0;
    for (const habit of habits) {
      total += 1;
      if (isHabitCompleteOn(habit, logsByHabit[habit.id], date)) {
        completed += 1;
        dayCompleted += 1;
      }
    }
    return { date, completed: dayCompleted, total: habits.length };
  });
  return { completed, total, perDay };
}

export function smokeFreeDaysThisWeek(habit: Habit, logs: DailyLog[] | undefined): number {
  return last7Days().filter((date) => {
    const log = selectLogForDate(logs, date);
    return log !== undefined && log.amount === 0;
  }).length;
}

export function estimatedSavingsThisWeek(habit: Habit, logs: DailyLog[] | undefined): number {
  if (!habit.hasCost) return 0;
  const baseline = baselineCost(habit);
  return last7Days().reduce((sum, date) => {
    const log = selectLogForDate(logs, date);
    if (!log) return sum;
    const spent = costForAmount(habit, log.amount);
    return sum + Math.max(0, baseline - spent);
  }, 0);
}

export function totalAmountThisWeek(logs: DailyLog[] | undefined): number {
  return last7Days().reduce((sum, date) => {
    const log = selectLogForDate(logs, date);
    return sum + (log?.amount ?? 0);
  }, 0);
}

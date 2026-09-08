import { addDays, last7Days, last7DaysEndingDaysAgo, todayISO } from "./dates";
import type { DailyLog, Habit } from "./types";
import { selectLogForDate } from "./store";

export function formatTime12h(time: string | null): string {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

export function isHabitCompleteOn(habit: Habit, logs: DailyLog[] | undefined, date: string): boolean {
  const log = selectLogForDate(logs, date);
  if (habit.kind === "quit") return log !== undefined;
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

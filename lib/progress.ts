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

// For most cost-tracked habits, pricePerItem already means "per dose/unit
// consumed". Medication with stock tracking on is the one exception -
// there the user enters the price of a whole packet, so this divides it
// down to a per-tablet price first. Every other habit falls through
// unchanged.
export function pricePerDose(habit: Habit): number {
  if (!habit.pricePerItem) return 0;
  if (habit.templateId === "medication" && habit.tabletsPerPacket) {
    return habit.pricePerItem / habit.tabletsPerPacket;
  }
  return habit.pricePerItem;
}

export function costForAmount(habit: Habit, amount: number): number {
  if (!habit.hasCost || !habit.pricePerItem) return 0;
  return amount * pricePerDose(habit);
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

// This week's real spend for a cost-tracked "good" habit (e.g. Medication) -
// unlike estimatedSavingsThisWeek, there's no baseline to compare against,
// just the actual total.
export function totalCostThisWeek(habit: Habit, logs: DailyLog[] | undefined): number {
  if (!habit.hasCost) return 0;
  return last7Days().reduce((sum, date) => {
    const log = selectLogForDate(logs, date);
    if (!log) return sum;
    return sum + costForAmount(habit, log.amount);
  }, 0);
}

export function daysUntilExam(habit: Habit): number | null {
  if (!habit.examDate) return null;
  return daysBetween(todayISO(), habit.examDate);
}

export function attendancePercent(habit: Habit): number {
  const held = habit.heldCount ?? 0;
  if (held <= 0) return 100;
  return Math.round(((habit.attendedCount ?? 0) / held) * 100);
}

// Plain arithmetic against the habit's own target %: how many more can be
// missed and still clear it, or how many in a row are needed to reach it.
export function attendanceGuidance(habit: Habit): string {
  const target = habit.attendanceTarget ?? 75;
  const attended = habit.attendedCount ?? 0;
  const held = habit.heldCount ?? 0;

  if (held === 0) return `Log your first class to start tracking toward ${target}%`;

  const percent = (attended / held) * 100;
  if (percent >= target) {
    const canMiss = Math.floor((attended * 100) / target - held);
    return canMiss > 0
      ? `You can miss ${canMiss} more and stay at ${target}%+`
      : `Right at the edge of ${target}% - don't miss the next one`;
  }

  const need = Math.ceil((target * held - 100 * attended) / (100 - target));
  return `Attend the next ${Math.max(need, 1)} in a row to reach ${target}%`;
}

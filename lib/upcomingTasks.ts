import { addDays, daysBetween, isoDate } from "./dates";
import { isHabitScheduledOn } from "./financialSummary";
import { computeDoseOccurrences, getTodayDoseTimes } from "./medicationSchedule";
import { parseDosageFrequency } from "./medicationParse";
import { isHabitCompleteOn } from "./progress";
import type { DailyLog, Habit } from "./types";

// What the Today screen's "Upcoming Tasks" tile lists. Nothing is stored: it is
// worked out from the habits and today's logs each time, so it follows every
// log, edit and notification action the moment the store changes. There is no
// separate task list in the app yet - "tasks" are the things the habits already
// schedule: reminders, medication doses, checkups and exams.

export type UpcomingKind = "reminder" | "dose" | "checkup" | "exam";

export interface UpcomingTask {
  id: string;
  habitId: string;
  kind: UpcomingKind;
  title: string;
  detail: string;
  time: string | null; // "HH:mm" for things due at a time of day, else null
  // "earlier": its time has passed and it is still open. Only timed tasks.
  status: "upcoming" | "earlier";
}

// An exam / checkup this many days away or fewer appears on Today.
const EXAM_HORIZON_DAYS = 30;
const CHECKUP_HORIZON_DAYS = 7;

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function isISODate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

// createdAt is UTC text, everything else is the device's local date.
function createdLocalDate(createdAt: string): string | null {
  const created = new Date(createdAt);
  return Number.isNaN(created.getTime()) ? null : isoDate(created);
}

function statusFor(time: string, nowMinutes: number): "upcoming" | "earlier" {
  return minutesOf(time) < nowMinutes ? "earlier" : "upcoming";
}

function medicationStartTime(habit: Habit): string {
  return habit.reminderTime && TIME_PATTERN.test(habit.reminderTime) ? habit.reminderTime : "08:00";
}

// Whether a medication's course covers `date`: it has started, and - inside a
// fixed-length course - the date is one of its own days (an ongoing one runs on).
// Also used by the Today reflection cards.
export function isMedicationCourseActive(habit: Habit, date: string): boolean {
  const startDate = habit.medicationStartDate ?? createdLocalDate(habit.createdAt) ?? date;
  if (!isISODate(startDate) || date < startDate) return false;
  const course = computeDoseOccurrences({
    dosageFrequency: habit.dosageFrequency,
    durationType: habit.durationType,
    startTime: medicationStartTime(habit),
    startDate,
  });
  return course === null || course.some((occurrence) => occurrence.date === date);
}

function doseTasks(habit: Habit, logs: readonly DailyLog[] | undefined, today: string, nowMinutes: number): UpcomingTask[] {
  if (!isMedicationCourseActive(habit, today)) return [];
  const startTime = medicationStartTime(habit);

  const times = getTodayDoseTimes({ dosageFrequency: habit.dosageFrequency, durationType: habit.durationType, startTime });
  const timesPerDay = parseDosageFrequency(habit.dosageFrequency);
  const taken = Math.max(0, Math.floor(logs?.find((l) => l.date === today)?.amount ?? 0));
  const doseLabel = `${habit.doseAmount ?? ""} ${habit.doseUnit ?? ""}`.trim();

  // Doses are taken in schedule order; only a daily total is logged.
  return times.slice(taken).map((time, i) => ({
    id: `dose-${habit.id}-${taken + i}`,
    habitId: habit.id,
    kind: "dose" as const,
    title: `Take ${habit.name}`,
    detail: `${doseLabel ? `${doseLabel} - ` : ""}dose ${taken + i + 1} of ${timesPerDay}`,
    time,
    status: statusFor(time, nowMinutes),
  }));
}

function reminderDetail(habit: Habit, logs: readonly DailyLog[] | undefined, today: string): string {
  const amount = logs?.find((l) => l.date === today)?.amount ?? 0;
  if (habit.kind === "quit") return "Check in";
  if (habit.trackingMethod === "amount") return `${amount} of ${habit.targetAmount ?? "?"} ${habit.unit ?? ""}`.trim();
  return "Mark it done";
}

// The next checkup date implied by the repeating reminder: it is scheduled every
// `intervalDays` from when the habit was created.
function nextCheckupDate(habit: Habit, intervalDays: number, today: string): string | null {
  const created = createdLocalDate(habit.createdAt);
  if (created === null || !Number.isFinite(intervalDays) || intervalDays < 1) return null;
  const elapsed = Math.max(0, daysBetween(created, today));
  const cycles = Math.max(1, Math.ceil(elapsed / intervalDays));
  return addDays(created, cycles * intervalDays);
}

function dayWords(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

export interface UpcomingInput {
  habits: readonly Habit[];
  logsByHabit: Readonly<Record<string, readonly DailyLog[] | undefined>>;
  today: string; // local "YYYY-MM-DD"
  nowMinutes: number; // minutes since local midnight
}

// Timed tasks first, in clock order (a task whose time has passed but that is
// still open stays in place, flagged "earlier"); tasks without a time of day
// (checkups, exams) follow, soonest first.
export function buildUpcomingTasks({ habits, logsByHabit, today, nowMinutes }: UpcomingInput): UpcomingTask[] {
  if (!isISODate(today)) return [];
  const now = Number.isFinite(nowMinutes) ? Math.min(Math.max(Math.floor(nowMinutes), 0), 1439) : 0;

  const timed: UpcomingTask[] = [];
  const untimed: { task: UpcomingTask; days: number }[] = [];

  for (const habit of habits) {
    if (habit.archivedAt) continue;
    const logs = logsByHabit[habit.id];

    if (habit.templateId === "medication" && habit.dosageFrequency) {
      if (isHabitScheduledOn(habit, today)) timed.push(...doseTasks(habit, logs, today, now));
      continue;
    }

    if (habit.templateId === "doctor_checkup" && habit.checkupIntervalDays) {
      const due = nextCheckupDate(habit, habit.checkupIntervalDays, today);
      const days = due === null ? Infinity : daysBetween(today, due);
      if (due !== null && days >= 0 && days <= CHECKUP_HORIZON_DAYS) {
        untimed.push({
          days,
          task: {
            id: `checkup-${habit.id}`,
            habitId: habit.id,
            kind: "checkup",
            title: habit.name,
            detail: `Checkup ${dayWords(days)}`,
            time: null,
            status: "upcoming",
          },
        });
      }
      continue;
    }

    if (isISODate(habit.examDate)) {
      const days = daysBetween(today, habit.examDate);
      if (days >= 0 && days <= EXAM_HORIZON_DAYS) {
        untimed.push({
          days,
          task: {
            id: `exam-${habit.id}`,
            habitId: habit.id,
            kind: "exam",
            title: habit.name,
            detail: `Exam ${dayWords(days)}`,
            time: null,
            status: "upcoming",
          },
        });
      }
    }

    // A reminder only matters while the habit is still open today.
    if (
      habit.reminderEnabled &&
      habit.reminderTime &&
      TIME_PATTERN.test(habit.reminderTime) &&
      isHabitScheduledOn(habit, today) &&
      !isHabitCompleteOn(habit, logs as DailyLog[] | undefined, today)
    ) {
      timed.push({
        id: `reminder-${habit.id}`,
        habitId: habit.id,
        kind: "reminder",
        title: habit.name,
        detail: reminderDetail(habit, logs, today),
        time: habit.reminderTime,
        status: statusFor(habit.reminderTime, now),
      });
    }
  }

  timed.sort((a, b) => minutesOf(a.time as string) - minutesOf(b.time as string) || a.title.localeCompare(b.title));
  untimed.sort((a, b) => a.days - b.days || a.task.title.localeCompare(b.task.title));
  return [...timed, ...untimed.map((entry) => entry.task)];
}

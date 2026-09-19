import { addDays, daysBetween, isoDate, weekdayLetter } from "./dates";
import { isHabitScheduledOn } from "./financialSummary";
import { getTodayDoseTimes } from "./medicationSchedule";
import { parseDosageFrequency } from "./medicationParse";
import { computeStreak, formatTime12h, isHabitCompleteOn } from "./progress";
import type { DailyLog, Habit } from "./types";
import { isMedicationCourseActive } from "./upcomingTasks";

// The data behind the swipeable reflection cards at the top of Today. Nothing is
// stored: every card is worked out from the habits and their logs each time, and a
// card exists only when the user has habits of that kind - a person who never
// creates a quit habit never sees a quit card, and one with only a jogging habit
// sees only that. (Money is the separate financial card, see SummaryDashboardCard.)

export type ReflectionKind = "overview" | "medication" | "fitness" | "health" | "study" | "quit" | "starter";

// One day of the week strip: everything due that day was done, some of it was, none
// of it was (a day already gone), still waiting (today), or nothing was due.
export type DayState = "done" | "partial" | "missed" | "pending" | "off";

export interface ReflectionDay {
  date: string;
  letter: string;
  state: DayState;
  isToday: boolean;
}

export interface ReflectionStat {
  label: string;
  value: string;
}

export interface ReflectionRing {
  fraction: number; // 0..1
  center: string;
  caption: string;
}

export interface ReflectionCardData {
  id: string;
  kind: ReflectionKind;
  title: string;
  message: string;
  streak: number; // best current streak in days, 0 hides the pill
  ring: ReflectionRing | null;
  stats: ReflectionStat[];
  week: ReflectionDay[] | null;
}

export interface ReflectionInput {
  habits: readonly Habit[];
  logsByHabit: Readonly<Record<string, DailyLog[] | undefined>>;
  today: string; // local "YYYY-MM-DD"
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function createdLocalDate(habit: Habit): string | null {
  const created = new Date(habit.createdAt);
  return Number.isNaN(created.getTime()) ? null : isoDate(created);
}

// Whether a habit has anything due on `date`: it existed by then and its schedule
// (or, for a medication, its course) covers the day.
function isActiveOn(habit: Habit, date: string): boolean {
  const created = createdLocalDate(habit);
  if (created !== null && date < created) return false;
  if (habit.templateId === "medication" && habit.dosageFrequency) return isMedicationCourseActive(habit, date);
  return isHabitScheduledOn(habit, date);
}

function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function percentText(done: number, total: number): string {
  return total === 0 ? "-" : `${Math.round((done / total) * 100)}%`;
}

interface Summary {
  scheduledToday: number;
  doneToday: number;
  week: ReflectionDay[];
  weekDone: number; // habit-days done over the last 7 days
  weekTotal: number; // habit-days due over the last 7 days
  activeDays: number; // days with at least one habit done
  onTrackDays: number; // days with everything due done
  dueDays: number; // days with something due
  streak: number;
}

function summarise(habits: readonly Habit[], input: ReflectionInput): Summary {
  const { logsByHabit, today } = input;
  const dates: string[] = [];
  for (let i = 6; i >= 0; i--) dates.push(addDays(today, -i));

  let weekDone = 0;
  let weekTotal = 0;
  let activeDays = 0;
  let onTrackDays = 0;
  let dueDays = 0;
  let scheduledToday = 0;
  let doneToday = 0;

  const week = dates.map((date): ReflectionDay => {
    const due = habits.filter((h) => isActiveOn(h, date));
    const done = due.filter((h) => isHabitCompleteOn(h, logsByHabit[h.id], date)).length;
    weekTotal += due.length;
    weekDone += done;
    if (done > 0) activeDays += 1;
    if (due.length > 0) {
      dueDays += 1;
      if (done === due.length) onTrackDays += 1;
    }
    if (date === today) {
      scheduledToday = due.length;
      doneToday = done;
    }

    let state: DayState;
    if (due.length === 0) state = "off";
    else if (done === due.length) state = "done";
    else if (done > 0) state = "partial";
    else state = date === today ? "pending" : "missed";
    return { date, letter: weekdayLetter(date), state, isToday: date === today };
  });

  const streak = Math.max(0, ...habits.map((h) => computeStreak(h, logsByHabit[h.id] as DailyLog[] | undefined)));
  return { scheduledToday, doneToday, week, weekDone, weekTotal, activeDays, onTrackDays, dueDays, streak };
}

function countRing(s: Summary, caption: string): ReflectionRing {
  if (s.scheduledToday === 0) return { fraction: 0, center: "-", caption: "nothing due today" };
  return { fraction: s.doneToday / s.scheduledToday, center: `${s.doneToday}/${s.scheduledToday}`, caption };
}

function streakStat(s: Summary, label = "Streak"): ReflectionStat {
  return { label, value: plural(s.streak, "day") };
}

function countMessage(s: Summary, allDone: string, nothingDue: string): string {
  if (s.scheduledToday === 0) return nothingDue;
  if (s.doneToday >= s.scheduledToday) return allDone;
  return `${s.scheduledToday - s.doneToday} to go today.`;
}

function overviewCard(habits: readonly Habit[], input: ReflectionInput): ReflectionCardData {
  const s = summarise(habits, input);
  return {
    id: "overview",
    kind: "overview",
    title: "Today",
    message: countMessage(s, "Everything done today. Well done.", "Nothing due today. Enjoy the rest."),
    streak: s.streak,
    ring: countRing(s, "done today"),
    stats: [
      { label: "This week", value: percentText(s.weekDone, s.weekTotal) },
      streakStat(s, "Best streak"),
      { label: "Habits", value: String(habits.length) },
    ],
    week: s.week,
  };
}

function medicationCard(habits: readonly Habit[], input: ReflectionInput): ReflectionCardData {
  const { logsByHabit, today } = input;
  const s = summarise(habits, input);

  let due = 0;
  let taken = 0;
  let next: string | null = null;
  for (const habit of habits) {
    if (!isActiveOn(habit, today)) continue;
    const perDay = habit.targetAmount ?? parseDosageFrequency(habit.dosageFrequency);
    const logged = Math.max(0, Math.floor(logsByHabit[habit.id]?.find((l) => l.date === today)?.amount ?? 0));
    due += perDay;
    taken += Math.min(logged, perDay);

    // Doses are taken in schedule order; only a daily total is logged.
    const startTime = habit.reminderTime && TIME_PATTERN.test(habit.reminderTime) ? habit.reminderTime : "08:00";
    const upcoming = getTodayDoseTimes({ dosageFrequency: habit.dosageFrequency, durationType: habit.durationType, startTime })[logged];
    if (upcoming && (next === null || upcoming < next)) next = upcoming;
  }

  const remaining = due - taken;
  let message = "No doses scheduled today.";
  if (due > 0) message = remaining === 0 ? "All doses taken. Well done." : `${plural(remaining, "dose")} left today.`;

  return {
    id: "medication",
    kind: "medication",
    title: "Medication",
    message,
    streak: s.streak,
    ring: due === 0 ? { fraction: 0, center: "-", caption: "no doses today" } : { fraction: taken / due, center: `${taken}/${due}`, caption: "doses today" },
    stats: [
      { label: "Next dose", value: next ? formatTime12h(next) : due > 0 ? "All taken" : "None today" },
      { label: "7-day adherence", value: percentText(s.weekDone, s.weekTotal) },
      streakStat(s),
    ],
    week: s.week,
  };
}

function fitnessCard(habits: readonly Habit[], input: ReflectionInput): ReflectionCardData {
  const { logsByHabit, today } = input;
  const s = summarise(habits, input);

  // One amount-tracked habit (say, a daily jog) gets a ring of the amount itself.
  const only = habits.length === 1 ? habits[0] : null;
  const target = only?.targetAmount ?? null;
  const amountHabit = only !== null && only.trackingMethod === "amount" && target !== null && target > 0 && isActiveOn(only, today);
  const todayAmount = only ? logsByHabit[only.id]?.find((l) => l.date === today)?.amount ?? 0 : 0;

  // The same unit on every habit means the week's amounts can be added up.
  const units = new Set(habits.map((h) => (h.trackingMethod === "amount" ? h.unit ?? "" : null)));
  const sharedUnit = units.size === 1 && !units.has(null) ? [...units][0] : null;
  const weekDates = s.week.map((d) => d.date);
  const weekTotal = habits.reduce(
    (sum, h) => sum + weekDates.reduce((inner, date) => inner + (logsByHabit[h.id]?.find((l) => l.date === date)?.amount ?? 0), 0),
    0
  );

  let message = countMessage(s, "Goal hit today. Keep it going.", "Rest day. Nothing scheduled.");
  if (amountHabit && target !== null && todayAmount < target) {
    message = `${formatNumber(target - todayAmount)} ${only?.unit ?? ""} to go.`.replace("  ", " ");
  }

  return {
    id: "fitness",
    kind: "fitness",
    title: "Fitness",
    message,
    streak: s.streak,
    ring:
      amountHabit && target !== null
        ? { fraction: Math.min(todayAmount / target, 1), center: `${formatNumber(todayAmount)}/${formatNumber(target)}`, caption: only?.unit || "today" }
        : countRing(s, "done today"),
    stats: [
      { label: "This week", value: percentText(s.weekDone, s.weekTotal) },
      streakStat(s),
      sharedUnit !== null
        ? { label: "Week total", value: `${formatNumber(weekTotal)} ${sharedUnit}`.trim() }
        : { label: "Active days", value: `${s.activeDays} of 7` },
    ],
    week: s.week,
  };
}

function healthCard(habits: readonly Habit[], input: ReflectionInput): ReflectionCardData {
  const s = summarise(habits, input);
  return {
    id: "health",
    kind: "health",
    title: "Health",
    message: countMessage(s, "Health checks done today.", "No health checks due today."),
    streak: s.streak,
    ring: countRing(s, "done today"),
    stats: [
      { label: "This week", value: percentText(s.weekDone, s.weekTotal) },
      streakStat(s),
      { label: "Tracking", value: plural(habits.length, "habit") },
    ],
    week: s.week,
  };
}

function studyCard(habits: readonly Habit[], input: ReflectionInput): ReflectionCardData {
  const { today } = input;
  const s = summarise(habits, input);

  let soonest: number | null = null;
  let attended = 0;
  let held = 0;
  for (const habit of habits) {
    if (habit.examDate && /^\d{4}-\d{2}-\d{2}$/.test(habit.examDate)) {
      const days = daysBetween(today, habit.examDate);
      if (days >= 0 && (soonest === null || days < soonest)) soonest = days;
    }
    if (habit.attendanceTarget !== null) {
      attended += habit.attendedCount ?? 0;
      held += habit.heldCount ?? 0;
    }
  }

  const stats: ReflectionStat[] = [];
  if (soonest !== null) stats.push({ label: "Next exam", value: soonest === 0 ? "Today" : plural(soonest, "day") });
  if (held > 0) stats.push({ label: "Attendance", value: percentText(attended, held) });
  stats.push(streakStat(s));
  stats.push({ label: "This week", value: percentText(s.weekDone, s.weekTotal) });

  return {
    id: "study",
    kind: "study",
    title: "Study",
    message: countMessage(s, "Study done for today.", "No study sessions due today."),
    streak: s.streak,
    ring: countRing(s, "done today"),
    stats: stats.slice(0, 3),
    week: s.week,
  };
}

function quitCard(habits: readonly Habit[], input: ReflectionInput): ReflectionCardData {
  const { logsByHabit, today } = input;
  const s = summarise(habits, input);

  const dueToday = habits.filter((h) => isActiveOn(h, today));
  const logOf = (h: Habit) => logsByHabit[h.id]?.find((l) => l.date === today);
  const over = dueToday.filter((h) => logOf(h) !== undefined && !isHabitCompleteOn(h, logsByHabit[h.id], today)).length;
  const unlogged = dueToday.filter((h) => logOf(h) === undefined).length;

  let message = "On track today. Keep going.";
  if (dueToday.length === 0) message = "Nothing to log today.";
  else if (over > 0) message = "Over target today. Tomorrow is a fresh start.";
  else if (unlogged > 0) message = "Check in this evening.";

  const only = habits.length === 1 ? habits[0] : null;
  const onlyLog = only ? logOf(only) : undefined;
  const third: ReflectionStat = only
    ? { label: "Today", value: onlyLog ? `${formatNumber(onlyLog.amount)} ${only.unit ?? ""}`.trim() : "Not logged" }
    : { label: "Tracking", value: plural(habits.length, "habit") };

  return {
    id: "quit",
    kind: "quit",
    title: "Quitting",
    message,
    streak: s.streak,
    ring: countRing(s, "on track today"),
    stats: [
      streakStat(s, "On-track streak"),
      { label: "On track (7 days)", value: s.dueDays === 0 ? "-" : `${s.onTrackDays} of ${s.dueDays}` },
      third,
    ],
    week: s.week,
  };
}

// The cards, in order, for this user's habits. A habit kind with no habits gets no
// card; the overview appears once there are two or more habits (or when no kind has
// a card of its own, e.g. only a project habit); with no habits at all there is one
// invitation card.
export function buildReflectionCards(input: ReflectionInput): ReflectionCardData[] {
  const habits = input.habits.filter((h) => !h.archivedAt);
  if (habits.length === 0) {
    return [
      {
        id: "starter",
        kind: "starter",
        title: "Your reflection",
        message: "Tap + to add a habit. How you are doing shows up here.",
        streak: 0,
        ring: null,
        stats: [],
        week: null,
      },
    ];
  }

  const medication = habits.filter((h) => h.kind === "good" && h.templateId === "medication");
  const fitness = habits.filter((h) => h.kind === "good" && h.category === "fitness");
  const health = habits.filter((h) => h.kind === "good" && h.category === "health" && h.templateId !== "medication");
  const study = habits.filter((h) => h.kind === "good" && h.category === "study");
  const quit = habits.filter((h) => h.kind === "quit");

  const groups: ReflectionCardData[] = [];
  if (medication.length > 0) groups.push(medicationCard(medication, input));
  if (fitness.length > 0) groups.push(fitnessCard(fitness, input));
  if (health.length > 0) groups.push(healthCard(health, input));
  if (study.length > 0) groups.push(studyCard(study, input));
  if (quit.length > 0) groups.push(quitCard(quit, input));

  return habits.length >= 2 || groups.length === 0 ? [overviewCard(habits, input), ...groups] : groups;
}

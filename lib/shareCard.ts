import NepaliDate from "nepali-date-converter";
import type { CalendarType } from "./calendarSettings";
import { computeGoalProgress, type FinancialSummary } from "./financialSummary";
import { isRealISODate } from "./habitSchedule";
import type { ReflectionCardData } from "./reflection";

// What goes on the shareable progress card. Pure, so the rule it exists to keep can be tested:
// the card carries NUMBERS ONLY - never a person's name, a habit's name, a note or a place. The
// builder is handed habits' names inside the summary but never reads them, and its output is only
// ever plain strings and numbers built here.

export interface ShareCardStat {
  label: string;
  value: string;
}

export interface ShareCardData {
  monthLabel: string; // "September 2026" / "आश्विन २०८३"; empty when unknown
  heroLabel: string;
  heroValue: string;
  goal: { percent: number; caption: string } | null; // percent 0..100
  stats: ShareCardStat[]; // at most three
}

export interface ShareCardInput {
  summary: FinancialSummary;
  monthlyGoal: number | null;
  reflectionCards: readonly ReflectionCardData[];
  calendarType: CalendarType;
  formatMoney: (amount: number) => string;
}

const MAX_STATS = 3;

// The month a date belongs to, named in the person's calendar.
export function formatMonthLabel(dateISO: string, calendarType: CalendarType): string {
  if (!isRealISODate(dateISO)) return "";
  const [year, month, day] = dateISO.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (calendarType === "bikram_sambat") {
    try {
      return new NepaliDate(date).format("MMMM YYYY", "np");
    } catch {
      // outside the converter's range: fall back to the English month
    }
  }
  return date.toLocaleDateString("en", { month: "long", year: "numeric" });
}

function daysText(count: number): string {
  return `${count} ${count === 1 ? "day" : "days"}`;
}

// "This week 29%" from the overview card, if the person has one.
function weekPercent(cards: readonly ReflectionCardData[]): string | null {
  for (const card of cards) {
    const stat = card.stats.find((s) => s.label === "This week");
    if (stat && stat.value !== "-") return stat.value;
  }
  return null;
}

// The card's content, or null when there is nothing worth showing yet (no saving, no clean day and
// no streak): a card of zeros is not an achievement, so the screen says so instead of sharing one.
export function buildShareCard(input: ShareCardInput): ShareCardData | null {
  const { summary, monthlyGoal, reflectionCards, calendarType, formatMoney } = input;

  const bestStreak = Math.max(0, ...reflectionCards.map((card) => card.streak));
  const cleanDays = summary.habits.reduce((sum, habit) => sum + habit.cleanDaysThisMonth, 0);
  const week = weekPercent(reflectionCards);
  const monthLabel = formatMonthLabel(summary.monthStart, calendarType);

  const stats: ShareCardStat[] = [];
  const addStat = (label: string, value: string) => {
    if (stats.length < MAX_STATS) stats.push({ label, value });
  };

  if (summary.hasSufficientData) {
    if (summary.savedThisMonth <= 0 && cleanDays === 0 && bestStreak === 0) return null;

    if (cleanDays > 0) addStat(cleanDays === 1 ? "Clean day" : "Clean days", String(cleanDays));
    if (bestStreak > 0) addStat("Best streak", daysText(bestStreak));
    if (week !== null) addStat("This week", week);

    const goal = computeGoalProgress(summary.savedThisMonth, monthlyGoal);
    return {
      monthLabel,
      heroLabel: "Saved this month",
      heroValue: formatMoney(summary.savedThisMonth),
      goal: goal
        ? { percent: goal.percent, caption: goal.completed ? "Monthly goal reached" : `${goal.displayPercent}% of monthly goal` }
        : null,
      stats,
    };
  }

  // No money to show (no cost-tracked habit): lead with the streak.
  if (bestStreak === 0) return null;
  if (week !== null) addStat("This week", week);
  return { monthLabel, heroLabel: "Best streak", heroValue: daysText(bestStreak), goal: null, stats };
}

// The path a capture returns, as a file URI the sharing and gallery modules accept.
export function toFileUri(path: string): string {
  return /^(file|content):\/\//.test(path) ? path : `file://${path}`;
}

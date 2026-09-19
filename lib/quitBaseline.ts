import { reduceDailyTargetForDate } from "./progress";
import { computeAmounts, fromMinor, getSavingsTerms, hasRecoverableBaseline } from "./savingsLedger";
import type { Habit } from "./types";

// The words on a quit habit's detail screen about its baseline and today's savings.
// Pure: the caller passes today's date and a money formatter, so it is easy to test.

// --- units: "sticks" <-> "stick" ------------------------------------------------

export function singularUnit(unit: string): string {
  const text = unit.trim();
  if (/[^aeiou]ies$/i.test(text)) return `${text.slice(0, -3)}y`;
  if (/(ch|sh|ss|x|z)es$/i.test(text)) return text.slice(0, -2);
  if (/s$/i.test(text) && !/ss$/i.test(text)) return text.slice(0, -1);
  return text;
}

function pluralUnit(singular: string): string {
  if (/(s|x|z|ch|sh)$/i.test(singular)) return `${singular}es`;
  if (/[^aeiou]y$/i.test(singular)) return `${singular.slice(0, -1)}ies`;
  return `${singular}s`;
}

// The unit worded for a count: exactly one is singular, everything else plural
// (including 0 and fractions). Works whether the stored unit was typed as "stick" or
// "sticks".
export function unitFor(unit: string | null | undefined, count: number): string {
  const base = (unit ?? "").trim();
  if (base === "") return "units";
  const singular = singularUnit(base);
  return count === 1 ? singular : pluralUnit(singular);
}

export function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

export function quantityText(count: number, unit: string | null | undefined): string {
  return `${formatQuantity(count)} ${unitFor(unit, count)}`;
}

// --- baseline and target ----------------------------------------------------------

type BaselineHabit = Pick<Habit, "baselineQuantity" | "unit">;

// "Baseline: 4 sticks/day" - the quantity stored when the habit was set up, or null
// when there is none to show (never worked out from anything else).
export function baselineLine(habit: BaselineHabit): string | null {
  if (!hasRecoverableBaseline(habit) || habit.baselineQuantity === null) return null;
  return `Baseline: ${quantityText(habit.baselineQuantity, habit.unit)}/day`;
}

// "Today's target: 4 sticks or fewer" for a reducing habit, "0 sticks" for quitting
// completely, nothing for tracking only (there is no target to aim at).
export function targetLine(
  habit: Pick<Habit, "baselineQuantity" | "unit" | "goalType" | "createdAt" | "reduceDays" | "termsHistory">,
  today: string
): string | null {
  if (!hasRecoverableBaseline(habit)) return null;
  if (habit.goalType === "quit_completely") return `Today's target: ${quantityText(0, habit.unit)}`;
  if (habit.goalType === "reduce") {
    const target = reduceDailyTargetForDate(habit, today);
    return target <= 0
      ? `Today's target: ${quantityText(0, habit.unit)}`
      : `Today's target: ${quantityText(target, habit.unit)} or fewer`;
  }
  return null;
}

// --- today's spending card ---------------------------------------------------------

export interface QuitDaySummary {
  logged: boolean;
  consumptionText: string; // what was consumed
  spendingText: string | null; // quantity x price = spent
  differenceText: string | null; // against the ORIGINAL baseline
  savedText: string;
}

// The four lines of the spending card. `logged` is whether the amount was recorded on
// purpose; a day nobody logged is unknown, so nothing is claimed as saved. Returns null
// when the habit has no usable baseline and price.
export function quitDaySummary(
  habit: Pick<Habit, "kind" | "hasCost" | "baselineQuantity" | "pricePerItem" | "unit">,
  quantity: number,
  logged: boolean,
  formatMoney: (amount: number) => string
): QuitDaySummary | null {
  const terms = getSavingsTerms(habit);
  if (!terms) return null;

  if (!logged) {
    return {
      logged: false,
      consumptionText: "Nothing logged yet today",
      spendingText: null,
      differenceText: null,
      savedText: "No saving is counted until you log today",
    };
  }

  const amounts = computeAmounts(terms.baselineQuantity, terms.unitPriceMinor, quantity);
  const price = fromMinor(terms.unitPriceMinor);

  let differenceText: string;
  if (quantity < terms.baselineQuantity) {
    differenceText = `${quantityText(terms.baselineQuantity - quantity, habit.unit)} below your baseline`;
  } else if (quantity > terms.baselineQuantity) {
    differenceText = `${quantityText(quantity - terms.baselineQuantity, habit.unit)} above your baseline`;
  } else {
    differenceText = "Exactly at your baseline";
  }

  return {
    logged: true,
    consumptionText: `${quantityText(quantity, habit.unit)} today`,
    spendingText: `${formatQuantity(quantity)} × ${formatMoney(price)} = ${formatMoney(fromMinor(amounts.actualSpendingMinor))} spent`,
    differenceText,
    savedText: `${formatMoney(fromMinor(amounts.savedMinor))} saved today`,
  };
}

import type { FinancialSettings } from "./types";

// Pure helpers for the persisted financial settings (a single row in the
// financial_settings table, mirrored in the Zustand store).

export const DEFAULT_CURRENCY_CODE = "NPR";

export const DEFAULT_FINANCIAL_SETTINGS: FinancialSettings = {
  monthlyGoal: null,
  currencyCode: DEFAULT_CURRENCY_CODE,
};

// A goal has to be a real, positive amount. Anything else (0, negative, NaN,
// Infinity) means "no goal", never a goal of zero. The cap keeps a typo from
// producing a value the UI can't lay out.
const MAX_MONTHLY_GOAL = 1_000_000_000;

export function isValidMonthlyGoal(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value <= MAX_MONTHLY_GOAL;
}

// "usd", " npr " -> "USD", "NPR"; anything that isn't three letters -> null.
export function normalizeCurrencyCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : null;
}

// Turns what a person typed ("1,500", "  2500.50 ") into a valid goal, or null
// when it is empty or not a usable amount. Rounded to whole cents.
export function parseMonthlyGoalInput(text: string): number | null {
  const cleaned = text.replace(/[,\s]/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const value = Math.round(Number(cleaned) * 100) / 100;
  return isValidMonthlyGoal(value) ? value : null;
}

// Whatever came out of the database becomes a safe settings object: a bad or
// missing goal is dropped and a bad currency falls back to the default.
export function sanitizeFinancialSettings(row: { monthlyGoal?: unknown; currencyCode?: unknown } | null | undefined): FinancialSettings {
  return {
    monthlyGoal: isValidMonthlyGoal(row?.monthlyGoal) ? row.monthlyGoal : null,
    currencyCode: normalizeCurrencyCode(row?.currencyCode) ?? DEFAULT_CURRENCY_CODE,
  };
}

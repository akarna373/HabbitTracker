import type { TermsEntry } from "./types";

// A cost-tracked habit's baseline and price are not one fixed pair: they can change. Every
// change is kept as an entry that starts on a date and holds until the next one, and every
// piece of money maths asks "what were the terms ON THAT DATE?" - so a rise in price from 25
// to 30 only ever affects days from the change onward, wherever the figures are shown.
//
// Pure: no React, no store, no database.

export interface TermsFields {
  baselineQuantity: number | null;
  pricePerItem: number | null;
}

export interface HasTerms {
  baselineQuantity: number | null;
  pricePerItem?: number | null;
  // Oldest first is not required; entries are compared by date.
  termsHistory?: readonly TermsEntry[];
}

// The baseline and price in force on `date`: the entry with the latest start date that is not
// after it. A date before the first entry gets the first entry (the terms the habit began with).
// A habit with no history at all uses the values stored on the habit itself.
export function termsOn(habit: HasTerms, date: string): TermsFields {
  const history = habit.termsHistory;
  if (!history || history.length === 0) {
    return { baselineQuantity: habit.baselineQuantity, pricePerItem: habit.pricePerItem ?? null };
  }
  let inForce: TermsEntry | null = null;
  let earliest: TermsEntry = history[0];
  for (const entry of history) {
    if (entry.effectiveFrom < earliest.effectiveFrom) earliest = entry;
    if (entry.effectiveFrom <= date && (inForce === null || entry.effectiveFrom > inForce.effectiveFrom)) inForce = entry;
  }
  const chosen = inForce ?? earliest;
  return { baselineQuantity: chosen.baselineQuantity, pricePerItem: chosen.pricePerItem };
}

// Entries oldest first (for display and for a stable stored order).
export function sortedHistory(history: readonly TermsEntry[]): TermsEntry[] {
  return [...history].sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : a.effectiveFrom > b.effectiveFrom ? 1 : 0));
}

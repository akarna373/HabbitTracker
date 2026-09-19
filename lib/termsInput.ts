// Reading the baseline and price a person types on the "Baseline and price" screen.
// Pure, so the rules are tested. Anything that is not a clean, sensible amount is null:
// the screen then keeps Save disabled instead of storing a bad value.

// Generous ceilings that only exist to stop a slipped finger (an extra zero, a pasted
// number) from storing something the screens cannot lay out.
export const MAX_BASELINE = 100_000;
export const MAX_PRICE = 1_000_000;

// "1,500", " 25 " -> "1500", "25". Whole numbers or up to two decimals.
function clean(text: string): string | null {
  const cleaned = text.replace(/[,\s]/g, "");
  return /^\d+(\.\d{1,2})?$/.test(cleaned) ? cleaned : null;
}

// How much a person used per day before starting: more than 0.
export function parseBaselineInput(text: string): number | null {
  const cleaned = clean(text);
  if (cleaned === null) return null;
  const value = Number(cleaned);
  return value > 0 && value <= MAX_BASELINE ? value : null;
}

// What one unit costs: 0 is allowed (a free item), negative is not.
export function parsePriceInput(text: string): number | null {
  const cleaned = clean(text);
  if (cleaned === null) return null;
  const value = Number(cleaned);
  return value >= 0 && value <= MAX_PRICE ? value : null;
}

// A stored number back into an editable string: 25 -> "25", 12.5 -> "12.5", null -> "".
export function toEditableText(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return String(Number(value.toFixed(2)));
}

// Whether the typed values differ from what is stored (so Save has something to do).
export function termsDiffer(
  stored: { baselineQuantity: number | null; pricePerItem: number | null },
  baseline: number,
  price: number
): boolean {
  return stored.baselineQuantity !== baseline || stored.pricePerItem !== price;
}

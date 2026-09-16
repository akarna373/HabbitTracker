// Dependency-free on purpose - both lib/medicationSchedule.ts (imports from
// lib/notifications.ts) and lib/notifications.ts (needs these to size the
// low-stock threshold) import from here, so this file can't import from
// either of them without creating a cycle.

export const DOSAGE_FREQUENCIES = ["One time a day (od)", "Two times a day (bd)", "Three times a day (tds)"];

// "One time a day (od)" -> 1, "Two times a day (bd)" -> 2, "Three times a
// day (tds)" -> 3 (also accepts the older "Once/Twice/Thrice" wording, for
// any habit created before that rename). A custom entry is always numeric
// by the time it reaches here (see PickerField's numericSuffix in
// app/habit/basics.tsx), stored as "{n} times a day" - the digit match
// below covers that case too, so no separate custom parsing.
export function parseDosageFrequency(text: string | null): number {
  if (!text) return 1;
  const lower = text.toLowerCase();
  if (lower.startsWith("one time") || lower.startsWith("once")) return 1;
  if (lower.startsWith("two times") || lower.startsWith("twice")) return 2;
  if (lower.startsWith("three times") || lower.startsWith("thrice")) return 3;
  const match = text.match(/\d+/);
  return match ? Math.max(1, parseInt(match[0], 10)) : 1;
}

// "Week" -> 7, "Ten days" -> 10, "Month" -> 30 (approximate, fine for a
// reminder schedule). "Daily" means ongoing/no end date -> null. A custom
// entry is always numeric by the time it reaches here (stored as "{n}
// days"), so the digit match covers it.
export function parseDurationDays(text: string | null): number | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  if (lower === "daily") return null;
  if (lower === "week") return 7;
  if (lower === "ten days") return 10;
  if (lower === "month") return 30;
  const match = text.match(/\d+/);
  return match ? Math.max(1, parseInt(match[0], 10)) : null;
}

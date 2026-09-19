import { daysBetween } from "./dates";

// Pure rules for which background the Today's Summary card shows. No
// React, no storage, no clock and no Math.random: the caller passes "today" and
// a random function, so every rule here is deterministic and testable.
//
// A background is kept for three LOCAL CALENDAR days, not 72 hours: chosen on
// Monday it stays for Monday, Tuesday and Wednesday, and a new one is chosen on
// Thursday. Until anything has been chosen (first launch, or a damaged saved
// value) the default background is used.

// Must equal SUMMARY_BACKGROUNDS.length in components/summaryBackgrounds/registry
// (a type check there fails the build if the two ever drift apart).
export const SUMMARY_BACKGROUND_COUNT = 27;

// How many local calendar days one background lasts.
export const ROTATION_DAYS = 3;

// "26-pokhara_nepal", counting from 0. The registry checks the id at this position.
export const DEFAULT_BACKGROUND_INDEX = 25;

export interface BackgroundSelection {
  index: number; // position in the registry
  date: string; // local "YYYY-MM-DD" on which it was selected
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isISODate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

// Anything that isn't a well-formed selection inside the registry (wrong type,
// fractional or out-of-range index, malformed date) comes back null.
export function normalizeSelection(value: unknown, count: number): BackgroundSelection | null {
  if (typeof value !== "object" || value === null) return null;
  const { index, date } = value as { index?: unknown; date?: unknown };
  if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= count) return null;
  if (!isISODate(date)) return null;
  return { index, date };
}

// The stored form is JSON text; a missing, unparseable or invalid value is null.
export function parseStoredSelection(raw: string | null | undefined, count: number): BackgroundSelection | null {
  if (typeof raw !== "string" || raw === "") return null;
  try {
    return normalizeSelection(JSON.parse(raw), count);
  } catch {
    return null;
  }
}

export function serializeSelection(selection: BackgroundSelection): string {
  return JSON.stringify({ index: selection.index, date: selection.date });
}

// What shows before any choice exists, and when storage can't be read: the
// default background, dated today.
export function defaultSelection(today: string): BackgroundSelection {
  return { index: DEFAULT_BACKGROUND_INDEX, date: isISODate(today) ? today : "1970-01-01" };
}

// A background picked by hand (the easter-egg chooser): it starts a fresh
// three-day period today. Null for an index outside the registry or a bad date.
export function chooseBackground(index: unknown, today: string, count: number): BackgroundSelection | null {
  if (!isISODate(today)) return null;
  return normalizeSelection({ index, date: today }, count);
}

// A random index other than `exclude` (or any index when there is nothing to
// exclude). `random` must return a value in [0, 1); anything else is clamped, so
// a bad random source can never produce an out-of-range or repeated index.
export function pickRandomIndex(count: number, exclude: number | null, random: () => number): number {
  if (count <= 1) return 0;
  const raw = random();
  const r = Number.isFinite(raw) ? Math.min(Math.max(raw, 0), 0.9999999999) : 0;
  if (exclude === null || exclude < 0 || exclude >= count) return Math.floor(r * count);
  const k = Math.floor(r * (count - 1)); // 0 .. count-2, skipping `exclude`
  return k >= exclude ? k + 1 : k;
}

export interface PickInput {
  stored: unknown; // whatever was persisted or is currently held; validated here
  today: string; // local "YYYY-MM-DD"
  count: number;
  random: () => number;
}

export interface PickResult {
  selection: BackgroundSelection;
  // True when the selection differs from what was stored, i.e. it must be saved.
  changed: boolean;
}

export function pickBackground({ stored, today, count, random }: PickInput): PickResult {
  const previous = normalizeSelection(stored, count);

  // A broken "today" should never happen; keep whatever is showing, save nothing.
  if (!isISODate(today)) {
    return { selection: previous ?? defaultSelection(today), changed: false };
  }

  // Nothing usable stored (first run, or a corrupted value): the default.
  if (previous === null) {
    return { selection: defaultSelection(today), changed: true };
  }

  const elapsed = daysBetween(previous.date, today);

  // The device date moved backwards (clock changed, or travelled west across the
  // date line). Keep the background and re-anchor the period on today so the
  // three-day count stays sane instead of freezing until the old date catches up.
  if (elapsed < 0) {
    return { selection: { index: previous.index, date: today }, changed: true };
  }

  if (elapsed < ROTATION_DAYS) return { selection: previous, changed: false };

  // A new period: any background except the one that was just showing.
  return { selection: { index: pickRandomIndex(count, previous.index, random), date: today }, changed: true };
}

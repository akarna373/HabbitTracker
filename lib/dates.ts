export function todayISO(): string {
  return isoDate(new Date());
}

export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + delta);
  return isoDate(date);
}

export function daysBetween(fromISO: string, toISO: string): number {
  const [y1, m1, d1] = fromISO.split("-").map(Number);
  const [y2, m2, d2] = toISO.split("-").map(Number);
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  return Math.round((b - a) / 86400000);
}

// Oldest -> newest, 7 entries ending today.
export function last7Days(): string[] {
  return last7DaysEndingDaysAgo(0);
}

// Oldest -> newest, 7 entries ending `daysAgo` days before today.
export function last7DaysEndingDaysAgo(daysAgo: number): string[] {
  const end = addDays(todayISO(), -daysAgo);
  const out: string[] = [];
  for (let i = 6; i >= 0; i--) out.push(addDays(end, -i));
  return out;
}

const WEEKDAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

// Monday-first index (0=Mon..6=Sun) matching the habit repeatDays convention.
export function weekdayIndexMonFirst(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const jsDay = new Date(y, m - 1, d).getDay(); // 0=Sun..6=Sat
  return (jsDay + 6) % 7;
}

export function weekdayLetter(iso: string): string {
  return WEEKDAY_LETTERS[weekdayIndexMonFirst(iso)];
}

export function formatLongDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
}

// e.g. "Sep 13, 7:04 PM" - for a full ISO datetime, not a "YYYY-MM-DD" date.
export function formatShortDateTime(isoDateTime: string): string {
  const date = new Date(isoDateTime);
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

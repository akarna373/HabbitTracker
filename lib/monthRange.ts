import NepaliDate from "nepali-date-converter";
import { isoDate } from "./dates";
import { isRealISODate } from "./habitSchedule";
import type { CalendarType } from "./calendarSettings";

// The month a date belongs to, in the calendar the person chose, expressed as an
// inclusive range of canonical Gregorian ISO dates. Everything is stored as
// Gregorian dates; the chosen calendar only decides where a month starts and ends,
// so switching calendars regroups the same records without touching them.

export interface MonthRange {
  start: string; // first day, "YYYY-MM-DD" (Gregorian)
  end: string; // last day, inclusive
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function gregorianMonth(year: number, month: number): MonthRange {
  const lastDay = new Date(year, month, 0).getDate(); // month is 1-based here, so this is the last day of `month`
  return { start: `${year}-${pad(month)}-01`, end: `${year}-${pad(month)}-${pad(lastDay)}` };
}

// The library has no "days in month" accessor: walk forward from day 1 until the
// Bikram Sambat month rolls over (at most ~32 steps).
function daysInBsMonth(year: number, month: number): number {
  let day = 1;
  for (;;) {
    const probe = new NepaliDate(year, month, 1);
    probe.setDate(day + 1);
    if (probe.getMonth() !== month) return day;
    day++;
  }
}

// The month that contains `dateISO`, or null for something that is not a real date.
// A Bikram Sambat request falls back to the Gregorian month if the library cannot
// convert the date (it only covers a fixed range of years).
export function monthRangeFor(dateISO: string, calendarType: CalendarType): MonthRange | null {
  if (!isRealISODate(dateISO)) return null;
  const [year, month, day] = dateISO.split("-").map(Number);

  if (calendarType === "bikram_sambat") {
    try {
      // Built from local date parts (not parsed from the ISO text, which would read it
      // as UTC midnight and can land on the previous day west of Greenwich).
      const bs = new NepaliDate(new Date(year, month - 1, day));
      const bsYear = bs.getYear();
      const bsMonth = bs.getMonth();
      const length = daysInBsMonth(bsYear, bsMonth);
      return {
        start: isoDate(new NepaliDate(bsYear, bsMonth, 1).toJsDate()),
        end: isoDate(new NepaliDate(bsYear, bsMonth, length).toJsDate()),
      };
    } catch {
      // fall through to the Gregorian month
    }
  }
  return gregorianMonth(year, month);
}

export function isDateInRange(date: string, range: MonthRange): boolean {
  return date >= range.start && date <= range.end;
}

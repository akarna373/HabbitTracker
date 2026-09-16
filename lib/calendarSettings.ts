import * as Localization from "expo-localization";
import NepaliDate from "nepali-date-converter";
import Storage from "expo-sqlite/kv-store";
import { formatLongDate } from "./dates";

const KEY = "calendarType";

export type CalendarType = "gregorian" | "bikram_sambat";

// Same region check lib/currency.ts's getAlcoholUnitSuggestions already
// uses for NP/IN - a device set to Nepal defaults to the calendar that's
// actually used there, everyone else gets plain Gregorian.
function defaultCalendarType(): CalendarType {
  try {
    const region = Localization.getLocales()[0]?.regionCode;
    if (region === "NP") return "bikram_sambat";
  } catch {
    // fall through to the Gregorian default
  }
  return "gregorian";
}

export async function getCalendarType(): Promise<CalendarType> {
  const raw = await Storage.getItem(KEY);
  return raw === "gregorian" || raw === "bikram_sambat" ? raw : defaultCalendarType();
}

export async function saveCalendarType(type: CalendarType): Promise<void> {
  await Storage.setItem(KEY, type);
}

// Same "weekday, day month year" shape as lib/dates.ts's formatLongDate,
// but in whichever calendar the user picked in Settings - anywhere a
// Medication date is shown as a sentence (start date, "until" captions)
// should read in the region's own calendar, not always Gregorian.
export function formatLongDateForCalendar(iso: string, calendarType: CalendarType): string {
  if (calendarType !== "bikram_sambat") return formatLongDate(iso);
  const [y, m, d] = iso.split("-").map(Number);
  return new NepaliDate(new Date(y, m - 1, d)).format("dd, D MMMM YYYY", "np");
}

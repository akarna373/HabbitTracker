import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import NepaliDate from "nepali-date-converter";
import type { CalendarType } from "../lib/calendarSettings";
import { isoDate, todayISO } from "../lib/dates";
import { colors, spacing, typography } from "../lib/theme";

interface Cell {
  iso: string; // AD "YYYY-MM-DD"
  primary: string; // the digit shown large (Nepali numeral in BS mode)
  secondary?: string; // small AD date shown under it, BS mode only
}

interface Props {
  calendarType: CalendarType;
  markedDates: string[]; // AD ISO dates to highlight
  initialDate?: string; // AD ISO - which month to open on, defaults to today
  onSelectDate?: (date: string) => void;
}

// Walks forward one day at a time from date 1 until the BS month rolls
// over - the library has no direct "days in month" accessor, but this is
// cheap (at most ~32 iterations) and only runs once per rendered month.
function daysInBsMonth(year: number, month: number): number {
  let day = 1;
  while (true) {
    const probe = new NepaliDate(year, month, 1);
    probe.setDate(day + 1);
    if (probe.getMonth() !== month) return day;
    day++;
  }
}

// Short weekday labels for the BS header - format("dd", "np") turns out to
// return the full Nepali name in this library, not an abbreviation, so it's
// truncated to keep header cells narrow (matches the "आइ" style truncation
// already used by the reference Nepali calendar app).
function bsWeekdayHeaders(year: number, month: number): string[] {
  const first = new NepaliDate(year, month, 1);
  const weekStart = new NepaliDate(year, month, 1);
  weekStart.setDate(1 - first.getDay());
  const labels: string[] = [];
  const cursor = new NepaliDate(weekStart.getYear(), weekStart.getMonth(), weekStart.getDate());
  for (let i = 0; i < 7; i++) {
    labels.push(cursor.format("dd", "np").slice(0, 4));
    cursor.setDate(cursor.getDate() + 1);
  }
  return labels;
}

const GREGORIAN_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ThemedCalendar({ calendarType, markedDates, initialDate, onSelectDate }: Props) {
  const markedSet = useMemo(() => new Set(markedDates), [markedDates]);
  const today = todayISO();

  // One opacity/scale value per date ever seen, so a newly-marked date
  // (e.g. picking a start date, or re-picking a different one) animates in
  // - and a newly-unmarked one animates out - while a screen that opens
  // already-marked (the static course view) shows it immediately, no
  // animation on first mount.
  const animatedValues = useRef(new Map<string, Animated.Value>()).current;
  const prevMarkedRef = useRef<Set<string> | null>(null);

  function getAnimatedValue(iso: string, fallback: number): Animated.Value {
    let v = animatedValues.get(iso);
    if (!v) {
      v = new Animated.Value(fallback);
      animatedValues.set(iso, v);
    }
    return v;
  }

  useEffect(() => {
    const nextSet = new Set(markedDates);
    const prevSet = prevMarkedRef.current;

    if (prevSet === null) {
      for (const iso of nextSet) getAnimatedValue(iso, 1);
      prevMarkedRef.current = nextSet;
      return;
    }

    const newlyMarked = markedDates.filter((d) => !prevSet.has(d)).sort();
    const newlyUnmarked = Array.from(prevSet)
      .filter((d) => !nextSet.has(d))
      .sort();

    if (newlyMarked.length) {
      Animated.stagger(
        30,
        newlyMarked.map((iso) => {
          const v = getAnimatedValue(iso, 0);
          v.setValue(0);
          return Animated.timing(v, { toValue: 1, duration: 180, useNativeDriver: true });
        })
      ).start();
    }
    if (newlyUnmarked.length) {
      Animated.stagger(
        30,
        newlyUnmarked.map((iso) => {
          const v = getAnimatedValue(iso, 1);
          v.setValue(1);
          return Animated.timing(v, { toValue: 0, duration: 180, useNativeDriver: true });
        })
      ).start();
    }

    prevMarkedRef.current = nextSet;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markedDates]);

  // Viewed position lives in the *active* calendar system's own year/month
  // indexing (BS year/month when calendarType is bikram_sambat) - reset
  // whenever the calendar type itself changes, so switching in Settings
  // and coming back doesn't leave a stale position from the other system.
  const startFrom = initialDate ?? today;
  const [year, setYear] = useState(() => initialYear(calendarType, startFrom));
  const [month, setMonth] = useState(() => initialMonth(calendarType, startFrom));

  useEffect(() => {
    setYear(initialYear(calendarType, startFrom));
    setMonth(initialMonth(calendarType, startFrom));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarType]);

  const goToday = () => {
    setYear(initialYear(calendarType, today));
    setMonth(initialMonth(calendarType, today));
  };

  const shiftMonth = (delta: number) => {
    let nextMonth = month + delta;
    let nextYear = year;
    if (nextMonth < 0) {
      nextMonth = 11;
      nextYear -= 1;
    } else if (nextMonth > 11) {
      nextMonth = 0;
      nextYear += 1;
    }
    setYear(nextYear);
    setMonth(nextMonth);
  };

  const isBs = calendarType === "bikram_sambat";

  const { weekdayHeaders, title, cells } = useMemo(() => {
    if (isBs) {
      const first = new NepaliDate(year, month, 1);
      const totalDays = daysInBsMonth(year, month);
      const offset = first.getDay();
      const dayCells: (Cell | null)[] = Array.from({ length: offset }, () => null);
      for (let day = 1; day <= totalDays; day++) {
        const d = new NepaliDate(year, month, day);
        const ad = d.toJsDate();
        dayCells.push({
          iso: isoDate(ad),
          primary: d.format("D", "np"),
          secondary: `${ad.getDate()} ${ad.toLocaleString("en", { month: "short" })}`,
        });
      }
      return { weekdayHeaders: bsWeekdayHeaders(year, month), title: first.format("MMMM YYYY", "np"), cells: dayCells };
    }

    const first = new Date(year, month, 1);
    const totalDays = new Date(year, month + 1, 0).getDate();
    const offset = first.getDay();
    const dayCells: (Cell | null)[] = Array.from({ length: offset }, () => null);
    for (let day = 1; day <= totalDays; day++) {
      const d = new Date(year, month, day);
      dayCells.push({ iso: isoDate(d), primary: String(day) });
    }
    return {
      weekdayHeaders: GREGORIAN_WEEKDAYS,
      title: first.toLocaleString("en", { month: "long", year: "numeric" }),
      cells: dayCells,
    };
  }, [isBs, year, month]);

  return (
    <View>
      <View style={styles.headerRow}>
        <Pressable onPress={() => shiftMonth(-1)} hitSlop={8} style={styles.navButton}>
          <Text style={styles.navText}>{"‹"}</Text>
        </Pressable>
        <View style={styles.titleCol}>
          <Text style={styles.title}>{title}</Text>
        </View>
        <Pressable onPress={() => shiftMonth(1)} hitSlop={8} style={styles.navButton}>
          <Text style={styles.navText}>{"›"}</Text>
        </Pressable>
      </View>

      <Pressable onPress={goToday} style={styles.todayButton}>
        <Text style={styles.todayButtonText}>Today</Text>
      </Pressable>

      <View style={styles.weekdayRow}>
        {weekdayHeaders.map((label, i) => (
          <Text key={i} style={styles.weekdayText}>
            {label}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((cell, i) => {
          if (!cell) return <View key={i} style={styles.cell} />;
          const marked = markedSet.has(cell.iso);
          const isToday = cell.iso === today;
          const isElapsed = cell.iso < today;
          const animatedValue = animatedValues.get(cell.iso);
          const showFill = marked || !!animatedValue;
          return (
            <Pressable key={i} style={[styles.cell, isElapsed && styles.cellElapsed]} onPress={() => onSelectDate?.(cell.iso)}>
              <View style={[styles.dayCircle, isToday && styles.dayCircleToday]}>
                {showFill ? (
                  <Animated.View
                    style={[
                      styles.dayCircleFill,
                      animatedValue
                        ? {
                            opacity: animatedValue,
                            transform: [{ scale: animatedValue.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
                          }
                        : { opacity: 1 },
                    ]}
                  />
                ) : null}
                <Text style={[styles.dayText, marked && styles.dayTextMarked]}>{cell.primary}</Text>
              </View>
              {cell.secondary ? <Text style={styles.secondaryText}>{cell.secondary}</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function initialYear(calendarType: CalendarType, dateISO: string): number {
  if (calendarType === "bikram_sambat") return NepaliDate.fromAD(new Date(dateISO)).getYear();
  return new Date(dateISO).getFullYear();
}

function initialMonth(calendarType: CalendarType, dateISO: string): number {
  if (calendarType === "bikram_sambat") return NepaliDate.fromAD(new Date(dateISO)).getMonth();
  return new Date(dateISO).getMonth();
}

const CELL_SIZE = "14.28%"; // 100/7

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xs },
  navButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  navText: { ...typography.title, color: colors.textPrimary },
  titleCol: { flex: 1, alignItems: "center" },
  title: { ...typography.body, fontWeight: "700", color: colors.textPrimary },
  todayButton: { alignSelf: "center", paddingHorizontal: spacing.md, paddingVertical: 4, marginBottom: spacing.sm },
  todayButtonText: { ...typography.caption, color: colors.accentPink, fontWeight: "700" },
  weekdayRow: { flexDirection: "row" },
  weekdayText: {
    width: CELL_SIZE,
    textAlign: "center",
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: CELL_SIZE, alignItems: "center", marginBottom: spacing.sm },
  cellElapsed: { opacity: 0.35 },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  dayCircleFill: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    backgroundColor: colors.accentPink,
  },
  dayCircleToday: { borderWidth: 1.5, borderColor: colors.accentPink },
  dayText: { ...typography.body, color: colors.textPrimary, zIndex: 1 },
  dayTextMarked: { color: colors.background, fontWeight: "700" },
  secondaryText: { fontSize: 9, color: colors.textMuted, marginTop: 2 },
});

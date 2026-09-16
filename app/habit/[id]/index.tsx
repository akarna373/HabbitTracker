import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "../../../components/Card";
import { confirmDialog } from "../../../components/ConfirmDialog";
import { Counter } from "../../../components/Counter";
import { PrimaryButton } from "../../../components/PrimaryButton";
import { ProgressBar } from "../../../components/ProgressBar";
import { ScreenHeader } from "../../../components/ScreenHeader";
import { ThemedSwitch } from "../../../components/ThemedSwitch";
import { formatMoney } from "../../../lib/currency";
import { todayISO } from "../../../lib/dates";
import { formatLongDateForCalendar } from "../../../lib/calendarSettings";
import {
  ensureLocationPermission,
  findHotspots,
  getCurrentLocation,
  hasBackgroundLocationPermission,
  nearestHotspot,
} from "../../../lib/location";
import { scheduleImmediateNotification } from "../../../lib/notifications";
import { getCourseCalendarView } from "../../../lib/medicationSchedule";
import {
  attendanceGuidance,
  attendancePercent,
  baselineCost,
  computeStreak,
  costForAmount,
  daysUntilExam,
  pricePerDose,
  reduceCycleDay,
  reduceDailyTarget,
  REDUCE_CYCLE_DAYS,
  totalCostThisWeek,
} from "../../../lib/progress";
import { selectLogForDate, useStore } from "../../../lib/store";
import { colors, radii, spacing, typography } from "../../../lib/theme";
import { DUAL_METRIC_LABELS, DUAL_METRIC_TEMPLATE_IDS } from "../../../lib/templates";
import type { Microtask } from "../../../lib/types";

// A literal [] fallback in the selector below would be a new array every
// render, which breaks zustand's snapshot caching and spams a "getSnapshot
// should be cached" error - reuse one stable empty array instead.
const EMPTY_MICROTASKS: Microtask[] = [];

export default function HabitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const habit = useStore((s) => s.habits.find((h) => h.id === id));
  const microtasks = useStore((s) => s.microtasksByHabit[id ?? ""] ?? EMPTY_MICROTASKS);
  const logs = useStore((s) => s.logsByHabit[id ?? ""]);
  const incrementAmount = useStore((s) => s.incrementAmount);
  const toggleMicrotask = useStore((s) => s.toggleMicrotask);
  const deleteMicrotask = useStore((s) => s.deleteMicrotask);
  const saveReflection = useStore((s) => s.saveReflection);
  const logDualMetric = useStore((s) => s.logDualMetric);
  const logAttendance = useStore((s) => s.logAttendance);
  const confirmRestock = useStore((s) => s.confirmRestock);
  const setExactStock = useStore((s) => s.setExactStock);
  const calendarType = useStore((s) => s.calendarType);
  const deleteHabit = useStore((s) => s.deleteHabit);
  const setLocationTracking = useStore((s) => s.setLocationTracking);
  const setBackgroundLocationTracking = useStore((s) => s.setBackgroundLocationTracking);
  const smokeLocations = useStore((s) => s.smokeLocationsByHabit[id ?? ""]);

  const today = todayISO();
  const log = selectLogForDate(logs, today);
  const [reflection, setReflection] = useState(log?.reflection ?? "");
  // Mirrors habit.locationTrackingEnabled but flips the instant the user
  // taps, instead of waiting on the permission prompt + DB write - without
  // this the Switch (fully controlled by the store) stalls visibly before
  // moving.
  const [trackingUiValue, setTrackingUiValue] = useState(habit?.locationTrackingEnabled ?? false);
  const [backgroundUiValue, setBackgroundUiValue] = useState(habit?.backgroundLocationEnabled ?? false);
  const [metricA, setMetricA] = useState(log?.amount != null ? String(log.amount) : "");
  const [metricB, setMetricB] = useState(log?.amountB != null ? String(log.amountB) : "");
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [restockMode, setRestockMode] = useState<"add" | "set">("add");
  const [restockQty, setRestockQty] = useState("");

  useEffect(() => {
    setReflection(log?.reflection ?? "");
  }, [log?.reflection]);

  useEffect(() => {
    setMetricA(log?.amount != null ? String(log.amount) : "");
    setMetricB(log?.amountB != null ? String(log.amountB) : "");
  }, [log?.amount, log?.amountB]);

  useEffect(() => {
    if (!habit) {
      router.back();
    }
  }, [habit]);

  useEffect(() => {
    setTrackingUiValue(habit?.locationTrackingEnabled ?? false);
  }, [habit?.locationTrackingEnabled]);

  useEffect(() => {
    setBackgroundUiValue(habit?.backgroundLocationEnabled ?? false);
  }, [habit?.backgroundLocationEnabled]);

  useEffect(() => {
    if (!habit?.locationTrackingEnabled) return;
    let cancelled = false;
    (async () => {
      const current = await getCurrentLocation();
      if (!current || cancelled) return;
      const hotspots = findHotspots(smokeLocations ?? []);
      if (nearestHotspot(current, hotspots) !== null) {
        // A passive in-screen card read as encouragement to just go smoke
        // somewhere else - a real push notification is the actual deterrent,
        // since it can reach the user the moment they're at the spot, not
        // only if they happen to have this screen open already.
        scheduleImmediateNotification(
          "You're at your smoking location",
          "Please move away from this spot - it's better for your health and your finances."
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [habit?.locationTrackingEnabled, smokeLocations]);

  if (!habit) return null;

  const amount = log?.amount ?? 0;
  const streak = computeStreak(habit, logs);
  const isDualMetric = DUAL_METRIC_TEMPLATE_IDS.includes(habit.templateId ?? "");
  const isAttendance = habit.templateId === "attendance";
  const isExam = !!habit.examDate;
  const dualLabels = DUAL_METRIC_LABELS[habit.templateId ?? ""];
  const isMedication = habit.templateId === "medication";
  const courseView = isMedication
    ? getCourseCalendarView({
        dosageFrequency: habit.dosageFrequency,
        durationType: habit.durationType,
        startTime: habit.reminderTime ?? "08:00",
        medicationStartDate: habit.medicationStartDate ?? habit.createdAt.slice(0, 10),
      })
    : null;
  const courseDates = courseView ? Array.from(new Set(courseView.occurrences.map((o) => o.date))) : [];
  const courseEndDate = courseDates.length > 0 ? courseDates[courseDates.length - 1] : null;
  const tabletsNeeded = courseView ? courseView.occurrences.length : null;

  const toggleLocationTracking = async (value: boolean) => {
    setTrackingUiValue(value);
    if (value) {
      const granted = await ensureLocationPermission();
      if (!granted) {
        setTrackingUiValue(false);
        confirmDialog(
          "Location permission needed",
          "To warn you at places you usually smoke, allow this app to access your location.",
          [{ text: "OK" }]
        );
        return;
      }
    }
    await setLocationTracking(habit.id, value);
  };

  const toggleBackgroundLocationTracking = async (value: boolean) => {
    if (value) {
      // Only show the prominent-disclosure screen before the OS permission is
      // actually requested for the first time - once granted, re-enabling is
      // just a toggle, no need to walk the user through it again.
      if (await hasBackgroundLocationPermission()) {
        setBackgroundUiValue(true);
        await setBackgroundLocationTracking(habit.id, true);
        return;
      }
      router.push(`/habit/background-location-disclosure?habitId=${habit.id}`);
      return;
    }
    setBackgroundUiValue(false);
    await setBackgroundLocationTracking(habit.id, false);
  };

  const confirmDelete = () => {
    confirmDialog("Delete habit?", `This removes "${habit.name}" and its history.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteHabit(habit.id);
          router.back();
        },
      },
    ]);
  };

  const confirmDeleteMicrotask = (microtaskId: string, text: string) => {
    confirmDialog("Delete microtask?", `Remove "${text}" from this habit's steps.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteMicrotask(habit.id, microtaskId) },
    ]);
  };

  if (habit.kind === "quit" && habit.hasCost) {
    const cost = costForAmount(habit, amount);
    const isReduce = habit.goalType === "reduce";
    const day = reduceCycleDay(habit);
    // A "reduce" habit compares against that day's declining target instead
    // of the flat baseline forever - every other goal type keeps the
    // original flat-baseline comparison.
    const compareCost = isReduce ? costForAmount(habit, reduceDailyTarget(habit)) : baselineCost(habit);
    const diff = compareCost - cost;
    const compareLabel = isReduce ? "today's target" : "baseline";
    const cycleDays = habit.reduceDays ?? REDUCE_CYCLE_DAYS;
    const goalTag =
      habit.goalType === "reduce"
        ? `DAY ${day} OF ${cycleDays}`
        : habit.goalType === "quit_completely"
          ? "QUIT COMPLETELY"
          : habit.goalType === "track_only"
            ? "TRACKING ONLY"
            : "QUIT A HABIT";

    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScreenHeader title={habit.name} subtitle="Today's honest check-in" />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.tag}>
            <Text style={styles.tagText}>{goalTag}</Text>
          </View>

          <Counter
            value={amount}
            unit={`${habit.unit ?? ""} today`}
            onDecrement={() => incrementAmount(habit.id, today, -1)}
            onIncrement={() => incrementAmount(habit.id, today, 1)}
            minusDisabled={amount <= 0}
          />

          <Card highlighted>
            <Text style={styles.cardTitle}>Today's spending</Text>
            <Text style={styles.cardBody}>
              {amount} x {formatMoney(habit.pricePerItem ?? 0)} = {formatMoney(cost)}
            </Text>
            <Text style={styles.cardCaption}>
              {diff >= 0 ? `${formatMoney(diff)} less than ${compareLabel}` : `${formatMoney(Math.abs(diff))} more than ${compareLabel}`}
            </Text>
          </Card>

          <PrimaryButton title="Motivate me" onPress={() => router.push(`/habit/${habit.id}/motivate`)} />

          <Card style={styles.locationCard}>
            <View style={styles.row}>
              <View style={styles.rowTextCol}>
                <Text style={styles.cardTitle}>Track smoking locations</Text>
                <Text style={styles.cardCaption}>Warns you at your usual smoking spots</Text>
                <Text style={styles.cardCaption}>Log in the moment - bulk logs misplace the spot</Text>
              </View>
              <ThemedSwitch value={trackingUiValue} onValueChange={toggleLocationTracking} />
            </View>
            {trackingUiValue ? (
              <View style={[styles.row, styles.subRow]}>
                <View style={styles.rowTextCol}>
                  <Text style={styles.cardTitle}>Warn me even when the app is closed</Text>
                  <Text style={styles.cardCaption}>Needs background location - may be delayed by the OS</Text>
                </View>
                <ThemedSwitch value={backgroundUiValue} onValueChange={toggleBackgroundLocationTracking} />
              </View>
            ) : null}
            {trackingUiValue && (smokeLocations?.length ?? 0) > 0 ? (
              <PrimaryButton
                title="Manage recorded locations"
                variant="outline"
                size="small"
                onPress={() => router.push(`/habit/manage-locations?habitId=${habit.id}`)}
              />
            ) : null}
          </Card>

          {amount === 0 ? (
            <PrimaryButton
              title="I stayed smoke-free today"
              variant="outline"
              onPress={() => incrementAmount(habit.id, today, 0)}
              style={styles.statusButton}
            />
          ) : null}

          <PrimaryButton
            title="Today's summary"
            variant="outline"
            onPress={() => router.push(`/habit/${habit.id}/summary`)}
            style={amount === 0 ? undefined : styles.statusButton}
          />
          <PrimaryButton title="Delete habit" variant="outline" onPress={confirmDelete} style={styles.deleteButton} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title={habit.name} subtitle={habit.kind === "good" ? "Build a good habit" : "Quit a habit"} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.tag}>
          <Text style={styles.tagText}>{isExam ? `${daysUntilExam(habit)} DAYS UNTIL YOUR EXAM` : `DAY ${streak} STREAK`}</Text>
        </View>

        {isDualMetric && dualLabels ? (
          <Card>
            <Text style={styles.cardTitle}>Today's reading</Text>
            <View style={styles.targetRow}>
              <View style={styles.rowTextCol}>
                <Text style={styles.cardCaption}>{dualLabels.labelA} ({dualLabels.unitA})</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  value={metricA}
                  onChangeText={setMetricA}
                />
              </View>
              <View style={styles.rowTextCol}>
                <Text style={styles.cardCaption}>{dualLabels.labelB} ({dualLabels.unitB})</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  value={metricB}
                  onChangeText={setMetricB}
                />
              </View>
            </View>
            <PrimaryButton
              title="Save today's reading"
              variant="outline"
              style={styles.statusButton}
              onPress={() => {
                const a = Number(metricA);
                const b = Number(metricB);
                if (!metricA || !metricB || Number.isNaN(a) || Number.isNaN(b)) return;
                logDualMetric(habit.id, today, a, b);
              }}
            />
          </Card>
        ) : isAttendance ? (
          <Card>
            <View style={styles.row}>
              <PrimaryButton title="I attended" style={{ flex: 1, marginRight: spacing.sm }} onPress={() => logAttendance(habit.id, true)} />
              <PrimaryButton title="I missed" variant="outline" style={{ flex: 1 }} onPress={() => logAttendance(habit.id, false)} />
            </View>
            <Text style={[styles.cardBody, styles.statusButton]}>{attendancePercent(habit)}% attendance</Text>
            <Text style={styles.cardCaption}>{attendanceGuidance(habit)}</Text>
          </Card>
        ) : habit.trackingMethod === "amount" ? (
          <>
            <Counter
              value={amount}
              unit={`/ ${habit.targetAmount ?? "?"} ${habit.unit ?? ""} today`}
              onDecrement={() => incrementAmount(habit.id, today, -1)}
              onIncrement={() => incrementAmount(habit.id, today, 1)}
              minusDisabled={amount <= 0}
            />
            <ProgressBar progress={habit.targetAmount ? amount / habit.targetAmount : 0} style={styles.mainProgressBar} />
          </>
        ) : (
          <PrimaryButton
            title={amount >= 1 ? "Checked in today" : "Mark done for today"}
            onPress={() => incrementAmount(habit.id, today, amount >= 1 ? -1 : 1)}
          />
        )}

        {habit.templateId === "syllabus_progress" ? (
          <PrimaryButton
            title="Plan with AI"
            variant="outline"
            size="small"
            style={styles.statusButton}
            onPress={() => router.push(`/habit/syllabus-plan?habitId=${habit.id}`)}
          />
        ) : null}

        {habit.hasCost && !isMedication ? (
          <Card>
            <Text style={styles.cardTitle}>Today's spending</Text>
            <Text style={styles.cardBody}>
              {amount} x {formatMoney(habit.pricePerItem ?? 0)} = {formatMoney(costForAmount(habit, amount))}
            </Text>
            <Text style={styles.cardCaption}>{formatMoney(totalCostThisWeek(habit, logs))} this week</Text>
          </Card>
        ) : null}

        {isMedication && habit.tabletsPerPacket != null ? (
          <Card onPress={() => router.push(`/habit/${habit.id}/medicine-packet`)}>
            <View style={styles.row}>
              <Text style={styles.cardTitle}>{habit.name}</Text>
              <View style={[styles.samplePill, { backgroundColor: habit.pillColor ?? colors.accentPink }]} />
            </View>
            <Text style={styles.cardBody}>
              {habit.stockRemaining ?? 0} of {habit.totalTabletsBought ?? habit.tabletsPerPacket} left
            </Text>
            <ProgressBar
              progress={(habit.stockRemaining ?? 0) / (habit.totalTabletsBought ?? habit.tabletsPerPacket)}
              style={styles.stockProgressBar}
            />
            {tabletsNeeded !== null && habit.hasCost && habit.pricePerItem ? (
              <Text style={styles.cardCaption}>
                This course needs {tabletsNeeded} tablets - {formatMoney(tabletsNeeded * pricePerDose(habit))}
              </Text>
            ) : null}
            <PrimaryButton
              title="I bought more"
              variant="outline"
              size="small"
              style={styles.statusButton}
              onPress={() => {
                setRestockMode("add");
                setRestockQty(String(habit.tabletsPerPacket));
                setShowRestockModal(true);
              }}
            />
          </Card>
        ) : null}

        {isMedication && courseView && courseEndDate ? (
          <Card>
            <Text style={styles.cardBody}>
              {courseView.isRolling
                ? "Ongoing - showing the next 30 days"
                : `Lasts ${courseDates.length} days - until ${formatLongDateForCalendar(courseEndDate, calendarType)}`}
            </Text>
            <PrimaryButton
              title="View schedule"
              variant="outline"
              size="small"
              style={styles.statusButton}
              onPress={() => router.push(`/habit/${habit.id}/medicine-calendar`)}
            />
          </Card>
        ) : null}

        {microtasks.length > 0 && !isMedication ? (
          <Card>
            <Text style={styles.cardTitle}>Suggestions</Text>
            {microtasks.map((m) => {
              const done = log?.microtasksDone.includes(m.id) ?? false;
              return (
                <Text
                  key={m.id}
                  style={styles.microtask}
                  onPress={() => toggleMicrotask(habit.id, today, m.id)}
                  onLongPress={() => confirmDeleteMicrotask(m.id, m.text)}
                >
                  {done ? "[x] " : "[ ] "}
                  {m.text}
                </Text>
              );
            })}
          </Card>
        ) : null}

        {!isMedication ? (
          <>
            <Text style={styles.label}>TODAY'S REFLECTION</Text>
            <Card>
              <TextInput
                style={styles.input}
                placeholder="How did it go today?"
                placeholderTextColor={colors.textMuted}
                value={reflection}
                onChangeText={setReflection}
              />
            </Card>
            <PrimaryButton title="Save reflection" variant="outline" onPress={() => saveReflection(habit.id, today, reflection)} />
          </>
        ) : null}
        <PrimaryButton title="Delete habit" variant="outline" onPress={confirmDelete} style={styles.deleteButton} />
      </ScrollView>

      <Modal visible={showRestockModal} transparent animationType="fade" onRequestClose={() => setShowRestockModal(false)}>
        <View style={styles.restockOverlay}>
          <View style={styles.restockCard}>
            <Text style={styles.cardTitle}>
              {restockMode === "add" ? "How many tablets did you buy?" : "How many are left, exactly?"}
            </Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder={String(habit.tabletsPerPacket ?? "")}
              placeholderTextColor={colors.textMuted}
              value={restockQty}
              onChangeText={(t) => setRestockQty(t.replace(/[^0-9]/g, ""))}
              autoFocus
            />
            <View style={styles.restockButtonRow}>
              <PrimaryButton title="Cancel" variant="outline" style={styles.restockButton} onPress={() => setShowRestockModal(false)} />
              <PrimaryButton
                title={restockMode === "add" ? "Add" : "Set"}
                style={styles.restockButton}
                onPress={() => {
                  const qty = Number(restockQty);
                  if (restockMode === "add") {
                    if (qty > 0) confirmRestock(habit.id, qty);
                  } else if (qty >= 0) {
                    setExactStock(habit.id, qty);
                  }
                  setShowRestockModal(false);
                }}
              />
            </View>
            <Pressable
              style={styles.restockModeLink}
              onPress={() => {
                if (restockMode === "add") {
                  setRestockMode("set");
                  setRestockQty(String(habit.stockRemaining ?? 0));
                } else {
                  setRestockMode("add");
                  setRestockQty(String(habit.tabletsPerPacket));
                }
              }}
            >
              <Text style={styles.restockModeLinkText}>
                {restockMode === "add" ? "Messed up the count? Set the exact amount instead" : "Back to adding a purchase"}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  tag: {
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceRaised,
    borderRadius: 20,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginBottom: spacing.md,
  },
  tagText: { ...typography.label },
  cardTitle: { ...typography.body, fontWeight: "700", marginBottom: 4 },
  cardBody: { ...typography.body },
  cardCaption: { ...typography.caption, marginTop: 2 },
  microtask: { ...typography.body, marginBottom: spacing.xs },
  label: { ...typography.label, marginTop: spacing.md, marginBottom: spacing.xs },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  targetRow: { flexDirection: "row", gap: spacing.sm },
  subRow: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  rowTextCol: { flex: 1, paddingRight: spacing.sm },
  input: { ...typography.body, paddingVertical: 4 },
  locationCard: { marginTop: spacing.sm },
  statusButton: { marginTop: spacing.md },
  deleteButton: { marginTop: spacing.md },
  restockOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  restockCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  restockButtonRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  restockButton: { flex: 1 },
  stockProgressBar: { marginVertical: spacing.sm },
  samplePill: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: colors.border },
  mainProgressBar: { marginTop: spacing.sm, marginBottom: spacing.md },
  restockModeLink: { alignSelf: "center", marginTop: spacing.md },
  restockModeLinkText: { ...typography.caption, color: colors.accentPink, fontWeight: "700" },
});

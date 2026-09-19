import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { formatMoneyCompact, formatMoneyFull } from "../lib/currency";
import { computeGoalProgress } from "../lib/financialSummary";
import { useFinancialSummary } from "../lib/financialSummarySelectors";
import { useStore } from "../lib/store";
import { summaryColors as palette } from "../lib/summaryTheme";
import { colors, spacing } from "../lib/theme";
import { useReducedMotion } from "../lib/useReducedMotion";
import { GoalProgressBar } from "./GoalProgressBar";

const EMPTY_MESSAGE = "Add cost details to a habit to discover how much you are saving.";

export function SummaryDashboardCard() {
  const summary = useFinancialSummary();
  const monthlyGoal = useStore((s) => s.financialSettings.monthlyGoal);
  const reducedMotion = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;

  // If motion gets turned off mid-press, don't leave the card shrunken.
  useEffect(() => {
    if (reducedMotion) scale.setValue(1);
  }, [reducedMotion, scale]);

  const animateTo = (value: number) => {
    if (reducedMotion) return;
    Animated.timing(scale, { toValue: value, duration: 110, useNativeDriver: true }).start();
  };

  const light = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  const openSummary = () => {
    light();
    router.push("/summary");
  };
  const openGoalEditor = () => {
    light();
    router.push("/summary-goal");
  };

  const { hasSufficientData } = summary;
  const goal = hasSufficientData ? computeGoalProgress(summary.savedThisMonth, monthlyGoal) : null;

  let goalSpoken = "";
  if (goal) {
    goalSpoken = goal.completed
      ? ` Monthly goal reached: saved ${formatMoneyFull(goal.saved)} of ${formatMoneyFull(goal.goal)}.`
      : ` Monthly goal ${goal.displayPercent} percent complete: saved ${formatMoneyFull(goal.saved)} of ${formatMoneyFull(goal.goal)}.`;
  } else if (hasSufficientData) {
    goalSpoken = " No monthly goal set.";
  }

  const accessibilityLabel = hasSufficientData
    ? `Today's Summary. Potential savings today ${formatMoneyFull(summary.potentialSavingsToday)}. ` +
      `Saved this month ${formatMoneyFull(summary.savedThisMonth)}. ` +
      `Spent this month ${formatMoneyFull(summary.spentThisMonth)}.${goalSpoken}`
    : `Today's Summary. ${EMPTY_MESSAGE}`;

  return (
    // Only the content of the money card: the frame and the scene behind it belong to
    // Today's swiper (TodayCarousel), so they stay put while this slides.
    // Layers, bottom to top: a full-page Pressable (so every visible pixel opens the
    // summary), then the content. The content ignores touches except the goal button,
    // so a tap on any text falls through to the Pressable underneath.
    <Animated.View style={[styles.frame, { transform: [{ scale }] }]}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={openSummary}
        onPressIn={() => animateTo(0.98)}
        onPressOut={() => animateTo(1)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="Opens the full summary"
      />

      <View style={styles.content} pointerEvents="box-none">
        <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <View style={styles.headerRow}>
            <View style={styles.titleGroup}>
              <Ionicons name="wallet-outline" size={18} color={colors.accentPink} />
              <Text style={styles.title} numberOfLines={1}>
                Today’s Summary
              </Text>
            </View>
            <View style={styles.detailsHint}>
              <Text style={styles.detailsText}>Details</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.accentPink} />
            </View>
          </View>

          {hasSufficientData ? (
            <>
              <Text style={styles.primaryLabel}>Potential Savings Today</Text>
              <Text style={styles.primaryValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                {formatMoneyCompact(summary.potentialSavingsToday)}
              </Text>

              <View style={styles.divider} />

              <View style={styles.metricsRow}>
                <View style={styles.metric}>
                  <View style={styles.metricLabelRow}>
                    <Ionicons name="trending-up" size={15} color={palette.saved} />
                    <Text style={styles.metricLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                      Saved This Month
                    </Text>
                  </View>
                  <Text
                    style={[styles.metricValue, { color: palette.saved }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.6}
                  >
                    {formatMoneyCompact(summary.savedThisMonth)}
                  </Text>
                </View>
                <View style={styles.metric}>
                  <View style={styles.metricLabelRow}>
                    <Ionicons name="cash-outline" size={15} color={palette.spent} />
                    <Text style={styles.metricLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                      Spent This Month
                    </Text>
                  </View>
                  <Text
                    style={[styles.metricValue, { color: palette.spent }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.6}
                  >
                    {formatMoneyCompact(summary.spentThisMonth)}
                  </Text>
                </View>
              </View>

              {goal ? (
                <View style={styles.goalBlock}>
                  <View style={styles.goalHeader}>
                    {goal.completed ? (
                      <View style={styles.goalTitleGroup}>
                        <Ionicons name="checkmark-circle" size={16} color={palette.saved} />
                        <Text style={[styles.goalTitle, { color: palette.saved }]}>Goal reached</Text>
                      </View>
                    ) : (
                      <View style={styles.goalTitleGroup}>
                        <Ionicons name="flag-outline" size={15} color={palette.textDim} />
                        <Text style={styles.goalTitle}>Monthly goal</Text>
                      </View>
                    )}
                    <Text style={styles.goalPercent}>{goal.displayPercent}%</Text>
                  </View>
                  {/* Its own full-width line, so a large goal still fits (it shrinks to fit). */}
                  <Text style={styles.goalAmounts} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                    {formatMoneyCompact(goal.saved)} / {formatMoneyCompact(goal.goal)}
                  </Text>
                  <GoalProgressBar percent={goal.percent} />
                </View>
              ) : null}
            </>
          ) : (
            <Text style={styles.emptyText}>{EMPTY_MESSAGE}</Text>
          )}
        </View>

        {hasSufficientData && !goal ? (
          <Pressable
            onPress={openGoalEditor}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Set a monthly goal"
            style={({ pressed }) => [styles.goalChip, pressed && styles.goalChipPressed]}
          >
            <Ionicons name="flag-outline" size={15} color={colors.accentPink} />
            <Text style={styles.goalChipText}>Set a monthly goal</Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Fills its page in Today's swiper, which is as tall as the tallest card. flexGrow, not
  // flex: 1 - that has a zero basis, so the page would collapse and clip the content.
  frame: { flexGrow: 1 },
  // Compact: the whole card has to fit Today's swiper without pushing the tiles below
  // into the + button. The bottom padding leaves room for the swiper's page dots.
  content: { paddingHorizontal: spacing.md, paddingTop: 12, paddingBottom: 22 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  titleGroup: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  title: { color: palette.text, fontSize: 16, fontWeight: "700", flexShrink: 1, ...palette.textShadow },
  detailsHint: { flexDirection: "row", alignItems: "center", gap: 2, marginLeft: spacing.sm },
  detailsText: { color: colors.accentPink, fontSize: 13, fontWeight: "700" },
  primaryLabel: { color: palette.textDim, fontSize: 13, fontWeight: "600", letterSpacing: 0.3, ...palette.textShadow },
  primaryValue: { color: palette.text, fontSize: 34, fontWeight: "800", ...palette.textShadow },
  divider: { height: 1, backgroundColor: palette.divider, marginVertical: 6 },
  metricsRow: { flexDirection: "row", gap: spacing.md },
  // minWidth: 0 lets a long value shrink (adjustsFontSizeToFit) instead of
  // pushing the neighbouring column off the card.
  metric: { flex: 1, minWidth: 0 },
  metricLabelRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 2 },
  metricLabel: { color: palette.textDim, fontSize: 12, fontWeight: "600", flexShrink: 1, ...palette.textShadow },
  metricValue: { fontSize: 22, fontWeight: "800", ...palette.textShadow },
  goalBlock: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: palette.divider },
  goalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  goalTitleGroup: { flexDirection: "row", alignItems: "center", gap: 6 },
  goalTitle: { color: palette.textDim, fontSize: 13, fontWeight: "700", ...palette.textShadow },
  goalPercent: { color: palette.text, fontSize: 15, fontWeight: "800", ...palette.textShadow },
  goalAmounts: { color: palette.text, fontSize: 13, fontWeight: "600", marginTop: 2, marginBottom: 6, ...palette.textShadow },
  goalChip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.accentPink,
    backgroundColor: "rgba(255,79,139,0.08)",
  },
  goalChipPressed: { opacity: 0.8 },
  goalChipText: { color: colors.accentPink, fontSize: 13, fontWeight: "700" },
  emptyText: { color: palette.text, fontSize: 15, lineHeight: 22, ...palette.textShadow },
});

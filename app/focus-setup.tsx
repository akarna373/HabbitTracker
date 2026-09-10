import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PrimaryButton } from "../components/PrimaryButton";
import { saveFocusAreas } from "../lib/focus";
import { colors, spacing, typography } from "../lib/theme";

const FACEBOOK_BLUE = "#1877F2";

// Orchestrates one entrance sequence across all five chips, each animating
// only after the previous one finishes: bad (2s initial delay) -> good ->
// study -> personal goals -> achiever, with each gap shorter than the last.
function useIconEntrance() {
  const badShake = useRef(new Animated.Value(0)).current;
  const badColor = useRef(new Animated.Value(0)).current;
  const goodPop = useRef(new Animated.Value(0)).current;
  const studyPop = useRef(new Animated.Value(0)).current;
  const goalPop = useRef(new Animated.Value(0)).current;
  const achieverPop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled) return;
      if (reduced) {
        badColor.setValue(1);
        goodPop.setValue(1);
        studyPop.setValue(1);
        goalPop.setValue(1);
        achieverPop.setValue(1);
        return;
      }
      const pop = (value: Animated.Value) =>
        Animated.timing(value, { toValue: 1, duration: 280, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true });

      Animated.sequence([
        Animated.delay(2000),
        Animated.parallel([
          Animated.sequence([
            Animated.timing(badShake, { toValue: 1, duration: 80, easing: Easing.linear, useNativeDriver: true }),
            Animated.timing(badShake, { toValue: -1, duration: 160, easing: Easing.linear, useNativeDriver: true }),
            Animated.timing(badShake, { toValue: 1, duration: 160, easing: Easing.linear, useNativeDriver: true }),
            Animated.timing(badShake, { toValue: 0, duration: 80, easing: Easing.linear, useNativeDriver: true }),
          ]),
          Animated.timing(badColor, { toValue: 1, duration: 480, easing: Easing.out(Easing.ease), useNativeDriver: false }),
        ]),
        Animated.delay(300),
        pop(goodPop),
        Animated.delay(200),
        pop(studyPop),
        Animated.delay(150),
        pop(goalPop),
        Animated.delay(100),
        pop(achieverPop),
      ]).start();
    });
    return () => {
      cancelled = true;
    };
  }, [badShake, badColor, goodPop, studyPop, goalPop, achieverPop]);

  const badRotate = badShake.interpolate({ inputRange: [-1, 1], outputRange: ["-4deg", "4deg"] });
  return { badRotate, badColor, goodPop, studyPop, goalPop, achieverPop };
}

const FOCUS_AREAS: { id: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "good", label: "Good habits", icon: "thumbs-up" },
  { id: "bad", label: "Track bad habits", icon: "thumbs-down" },
  { id: "study", label: "Study", icon: "school-outline" },
  { id: "personal_goal", label: "Personal goals", icon: "flag-outline" },
  { id: "achiever", label: "Achiever", icon: "trophy-outline" },
];

export default function FocusSetupScreen() {
  const [selected, setSelected] = useState<string[]>([]);
  const { badRotate, badColor, goodPop, studyPop, goalPop, achieverPop } = useIconEntrance();
  const badgeBg = badColor.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(150,150,160,0.18)", "rgba(255,90,98,0.16)"],
  });
  const grayIconOpacity = badColor.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const popByArea: Record<string, Animated.Value> = {
    good: goodPop,
    study: studyPop,
    personal_goal: goalPop,
    achiever: achieverPop,
  };
  const popStyle = (pop: Animated.Value) => ({
    opacity: pop,
    transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
  });

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const finish = async () => {
    await saveFocusAreas(selected);
    router.replace("/(tabs)");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>What would you like to focus on?</Text>
        <Text style={styles.subtitle}>Pick as many as you like. You can change this later.</Text>

        <View style={styles.chipRow}>
          {FOCUS_AREAS.map((area) => {
            const active = selected.includes(area.id);
            const chip = (
              <Pressable
                key={area.id}
                onPress={() => toggle(area.id)}
                style={[styles.chip, active && styles.chipActive]}
              >
                {area.id === "good" ? (
                  <Animated.View style={[styles.chipIcon, styles.iconBadge, styles.goodIconBadge, popStyle(popByArea.good)]}>
                    <Ionicons name={area.icon} size={14} color={FACEBOOK_BLUE} />
                  </Animated.View>
                ) : area.id === "bad" ? (
                  <Animated.View style={[styles.chipIcon, styles.iconBadge, { backgroundColor: badgeBg }]}>
                    <Ionicons name={area.icon} size={14} color={colors.accentRed} style={styles.badIconOverlay} />
                    <Animated.View style={{ opacity: grayIconOpacity }}>
                      <Ionicons name={area.icon} size={14} color={colors.textMuted} />
                    </Animated.View>
                  </Animated.View>
                ) : (
                  <Animated.View style={popStyle(popByArea[area.id])}>
                    <Ionicons
                      name={area.icon}
                      size={16}
                      color={active ? colors.accentPink : colors.textSecondary}
                      style={styles.chipIcon}
                    />
                  </Animated.View>
                )}
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{area.label}</Text>
              </Pressable>
            );
            if (area.id === "bad") {
              return (
                <Animated.View key={area.id} style={{ transform: [{ rotate: badRotate }] }}>
                  {chip}
                </Animated.View>
              );
            }
            return chip;
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton title="Continue" onPress={finish} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.lg },
  title: { ...typography.title, marginBottom: spacing.xs },
  subtitle: { ...typography.caption, marginBottom: spacing.lg },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipIcon: { marginRight: spacing.xs },
  badIconOverlay: { position: "absolute" },
  iconBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  goodIconBadge: { backgroundColor: "rgba(24,119,242,0.16)" },
  chipActive: { borderColor: colors.accentPink, backgroundColor: colors.surface },
  chipText: { ...typography.body },
  chipTextActive: { color: colors.accentPink },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
});

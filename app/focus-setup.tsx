import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PrimaryButton } from "../components/PrimaryButton";
import { saveFocusAreas } from "../lib/focus";
import { colors, spacing, typography } from "../lib/theme";

// All five chips render fully visible immediately. After a 2s pause, "bad
// habits" wiggles while every chip's icon reveals from grey to its own
// colour, each in turn at a reading pace (even gaps, not rushed): bad ->
// good -> study -> fitness -> projects - as if the user's eyes were moving
// from one option to the next.
const READING_PACE_MS = 550;
const INITIAL_DELAY_MS = 2000;
const REVEAL_MS = 420;

interface AreaDef {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  tintBg: string;
}

const FOCUS_AREAS: AreaDef[] = [
  { id: "good", label: "Build good habits", icon: "thumbs-up", color: "#1877F2", tintBg: "rgba(24,119,242,0.16)" },
  { id: "bad", label: "Track bad habits", icon: "thumbs-down", color: colors.accentRed, tintBg: "rgba(255,90,98,0.16)" },
  { id: "study", label: "Study", icon: "school", color: "#8B5CF6", tintBg: "rgba(139,92,246,0.16)" },
  { id: "personal_goal", label: "Fitness", icon: "heart", color: "#FF3B5C", tintBg: "rgba(255,59,92,0.16)" },
  { id: "achiever", label: "Projects", icon: "trophy", color: "#F5A623", tintBg: "rgba(245,166,35,0.16)" },
];

const GREY_TINT_BG = "rgba(150,150,160,0.18)";

function useIconEntrance() {
  const badShake = useRef(new Animated.Value(0)).current;
  const continueOpacity = useRef(new Animated.Value(0)).current;
  const [introDone, setIntroDone] = useState(false);
  const colorByArea = useRef<Record<string, Animated.Value>>(
    Object.fromEntries(FOCUS_AREAS.map((a) => [a.id, new Animated.Value(0)]))
  ).current;
  const pulseByArea = useRef<Record<string, Animated.Value>>(
    Object.fromEntries(FOCUS_AREAS.filter((a) => a.id !== "bad").map((a) => [a.id, new Animated.Value(0)]))
  ).current;

  useEffect(() => {
    let cancelled = false;
    const markIntroDone = () => {
      if (cancelled) return;
      setIntroDone(true);
      Animated.timing(continueOpacity, { toValue: 1, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: false }).start();
    };
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled) return;
      if (reduced) {
        Object.values(colorByArea).forEach((v) => v.setValue(1));
        markIntroDone();
        return;
      }

      const pulse = (value: Animated.Value) =>
        Animated.sequence([
          Animated.timing(value, { toValue: 1, duration: 180, easing: Easing.out(Easing.ease), useNativeDriver: false }),
          Animated.timing(value, { toValue: 0, duration: 180, easing: Easing.in(Easing.ease), useNativeDriver: false }),
        ]);
      const reveal = (id: string) =>
        Animated.timing(colorByArea[id], { toValue: 1, duration: REVEAL_MS, easing: Easing.out(Easing.ease), useNativeDriver: false });

      Animated.sequence([
        Animated.delay(INITIAL_DELAY_MS),
        Animated.parallel([
          Animated.sequence([
            Animated.timing(badShake, { toValue: 1, duration: 80, easing: Easing.linear, useNativeDriver: false }),
            Animated.timing(badShake, { toValue: -1, duration: 160, easing: Easing.linear, useNativeDriver: false }),
            Animated.timing(badShake, { toValue: 1, duration: 160, easing: Easing.linear, useNativeDriver: false }),
            Animated.timing(badShake, { toValue: 0, duration: 80, easing: Easing.linear, useNativeDriver: false }),
          ]),
          reveal("bad"),
        ]),
        Animated.delay(READING_PACE_MS),
        Animated.parallel([pulse(pulseByArea.good), reveal("good")]),
        Animated.delay(READING_PACE_MS),
        Animated.parallel([pulse(pulseByArea.study), reveal("study")]),
        Animated.delay(READING_PACE_MS),
        Animated.parallel([pulse(pulseByArea.personal_goal), reveal("personal_goal")]),
        Animated.delay(READING_PACE_MS),
        Animated.parallel([pulse(pulseByArea.achiever), reveal("achiever")]),
      ]).start(markIntroDone);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [badShake]);

  const badRotate = badShake.interpolate({ inputRange: [-1, 1], outputRange: ["-4deg", "4deg"] });
  return { badRotate, colorByArea, pulseByArea, introDone, continueOpacity };
}

export default function FocusSetupScreen() {
  const [selected, setSelected] = useState<string[]>([]);
  const { badRotate, colorByArea, pulseByArea, introDone, continueOpacity } = useIconEntrance();

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
            const colorProgress = colorByArea[area.id];
            const badgeBg = colorProgress.interpolate({ inputRange: [0, 1], outputRange: [GREY_TINT_BG, area.tintBg] });
            const grayIconOpacity = colorProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
            const pulse = pulseByArea[area.id];

            const chip = (
              <Pressable
                key={area.id}
                onPress={() => toggle(area.id)}
                disabled={!introDone}
                style={[styles.chip, active && styles.chipActive, active && styles.chipSelected]}
              >
                <Animated.View
                  style={[
                    styles.chipIcon,
                    styles.iconBadge,
                    { backgroundColor: badgeBg },
                    pulse
                      ? { transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] }) }] }
                      : null,
                  ]}
                >
                  <Ionicons name={area.icon} size={14} color={area.color} style={styles.badIconOverlay} />
                  <Animated.View style={{ opacity: grayIconOpacity }}>
                    <Ionicons name={area.icon} size={14} color={colors.textMuted} />
                  </Animated.View>
                </Animated.View>
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

      <View style={styles.footer} pointerEvents={introDone ? "auto" : "none"}>
        <Animated.View style={{ opacity: continueOpacity }}>
          <PrimaryButton title="Continue" onPress={finish} />
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.lg },
  title: { ...typography.title, marginBottom: spacing.xs },
  subtitle: { ...typography.caption, marginBottom: spacing.lg },
  // Extra gap so two adjacent selected chips (scaled up via chipSelected)
  // don't visually overlap - scale grows a chip beyond its own layout box.
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    // A literal transparent background can make Android only hit-test the
    // painted child (the text), not the full chip - keep a near-invisible
    // real background so the whole chip is tappable.
    backgroundColor: "rgba(11,10,15,0.01)",
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
  chipActive: { borderColor: colors.accentPink, backgroundColor: colors.surface },
  chipSelected: { transform: [{ scale: 1.06 }] },
  chipText: { ...typography.body },
  chipTextActive: { color: colors.accentPink },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
});

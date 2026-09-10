import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ColorFadeIcon } from "../components/ColorFadeIcon";
import { PrimaryButton } from "../components/PrimaryButton";
import { saveFocusAreas } from "../lib/focus";
import { colors, spacing, typography } from "../lib/theme";

const GOOD_ICON_COLORS = [colors.accentPink, colors.accentRed, colors.softAccent];

// Drives both the one-shot wiggle and the grey -> coral-red reveal of the
// "bad habits" icon, timed to play together.
function useBadHabitEntrance() {
  const shake = useRef(new Animated.Value(0)).current;
  const colorProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled) return;
      if (reduced) {
        colorProgress.setValue(1);
        return;
      }
      Animated.parallel([
        Animated.sequence([
          Animated.delay(600),
          Animated.timing(shake, { toValue: 1, duration: 80, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(shake, { toValue: -1, duration: 160, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(shake, { toValue: 1, duration: 160, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(shake, { toValue: 0, duration: 80, easing: Easing.linear, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.delay(600),
          Animated.timing(colorProgress, { toValue: 1, duration: 480, easing: Easing.out(Easing.ease), useNativeDriver: false }),
        ]),
      ]).start();
    });
    return () => {
      cancelled = true;
    };
  }, [shake, colorProgress]);

  const rotate = shake.interpolate({ inputRange: [-1, 1], outputRange: ["-4deg", "4deg"] });
  return { rotate, colorProgress };
}

const FOCUS_AREAS: { id: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "good", label: "Good habits", icon: "thumbs-up-outline" },
  { id: "bad", label: "Track bad habits", icon: "thumbs-down" },
  { id: "study", label: "Study", icon: "school-outline" },
  { id: "personal_goal", label: "Personal goals", icon: "flag-outline" },
  { id: "achiever", label: "Achiever", icon: "trophy-outline" },
];

export default function FocusSetupScreen() {
  const [selected, setSelected] = useState<string[]>([]);
  const { rotate: badShake, colorProgress } = useBadHabitEntrance();
  const badgeBg = colorProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(150,150,160,0.18)", "rgba(255,90,98,0.16)"],
  });
  const grayIconOpacity = colorProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

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
                  <View style={styles.chipIcon}>
                    <ColorFadeIcon name={area.icon} colors={GOOD_ICON_COLORS} size={16} />
                  </View>
                ) : area.id === "bad" ? (
                  <Animated.View style={[styles.chipIcon, styles.badIconBadge, { backgroundColor: badgeBg }]}>
                    <Ionicons name={area.icon} size={14} color={colors.accentRed} style={styles.badIconOverlay} />
                    <Animated.View style={{ opacity: grayIconOpacity }}>
                      <Ionicons name={area.icon} size={14} color={colors.textMuted} />
                    </Animated.View>
                  </Animated.View>
                ) : (
                  <Ionicons
                    name={area.icon}
                    size={16}
                    color={active ? colors.accentPink : colors.textSecondary}
                    style={styles.chipIcon}
                  />
                )}
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{area.label}</Text>
              </Pressable>
            );
            if (area.id === "bad") {
              return (
                <Animated.View key={area.id} style={{ transform: [{ rotate: badShake }] }}>
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
  badIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255,90,98,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: { borderColor: colors.accentPink, backgroundColor: colors.surface },
  chipText: { ...typography.body },
  chipTextActive: { color: colors.accentPink },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
});

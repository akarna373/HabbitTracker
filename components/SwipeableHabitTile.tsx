import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useEffect, useRef } from "react";
import { Alert, Animated, Pressable, StyleSheet, Text } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useStore } from "../lib/store";
import { colors, radii, spacing, typography } from "../lib/theme";
import type { Habit } from "../lib/types";
import { Card } from "./Card";

// Only one tile's swipe actions may be open at a time. This module-level
// pointer lets any tile close whichever other tile was previously open,
// without threading refs through the parent list.
let openSwipeable: Swipeable | null = null;

function tick() {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Device/emulator without haptic support - ignore.
  }
}

const ACTION_WIDTH = 96;

interface Props {
  habit: Habit;
  done: boolean;
  subtitle: string;
  reminderText?: string | null;
  onPress: () => void;
}

export function SwipeableHabitTile({ habit, done, subtitle, reminderText, onPress }: Props) {
  const deleteHabit = useStore((s) => s.deleteHabit);
  const archiveHabit = useStore((s) => s.archiveHabit);
  const swipeSettings = useStore((s) => s.swipeSettings);
  const ref = useRef<Swipeable>(null);

  useEffect(() => {
    return () => {
      if (openSwipeable === ref.current) openSwipeable = null;
    };
  }, []);

  const confirmDelete = () => {
    ref.current?.close();
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // Device/emulator without haptic support - ignore.
    }
    Alert.alert("Delete habit?", `This removes "${habit.name}" and its history.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteHabit(habit.id) },
    ]);
  };

  const runArchive = () => {
    ref.current?.close();
    archiveHabit(habit.id);
  };

  const tile = (
    <Card onPress={onPress} highlighted={done} style={styles.card}>
      <Text style={styles.habitName}>{habit.name}</Text>
      <Text style={styles.habitSubtitle}>{subtitle}</Text>
      {reminderText ? <Text style={styles.habitReminder}>{reminderText}</Text> : null}
    </Card>
  );

  // Swipe Control (Settings) can turn either action off - skip the
  // Swipeable wrapper entirely once both are off, so the tile behaves
  // like a plain, non-swipeable card.
  if (!swipeSettings.archiveEnabled && !swipeSettings.deleteEnabled) {
    return tile;
  }

  return (
    <Swipeable
      ref={ref}
      containerStyle={styles.swipeContainer}
      overshootLeft={false}
      overshootRight={false}
      leftThreshold={ACTION_WIDTH / 2}
      rightThreshold={ACTION_WIDTH / 2}
      onSwipeableWillOpen={tick}
      onSwipeableOpen={() => {
        if (openSwipeable && openSwipeable !== ref.current) openSwipeable.close();
        openSwipeable = ref.current;
      }}
      onSwipeableClose={() => {
        if (openSwipeable === ref.current) openSwipeable = null;
      }}
      renderLeftActions={
        swipeSettings.archiveEnabled
          ? () => (
              <ActionButton
                side="left"
                colorsRange={["#6FA8FF", "#0D4F9E"]}
                icon="archive"
                label="Archive"
                onPress={runArchive}
              />
            )
          : undefined
      }
      renderRightActions={
        swipeSettings.deleteEnabled
          ? () => (
              <ActionButton
                side="right"
                colorsRange={["#FF8A93", "#B3202A"]}
                icon="trash"
                label="Delete"
                onPress={confirmDelete}
              />
            )
          : undefined
      }
    >
      {tile}
    </Swipeable>
  );
}

function ActionButton({
  side,
  colorsRange,
  icon,
  label,
  onPress,
}: {
  side: "left" | "right";
  colorsRange: [string, string];
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Animated.View style={[styles.action, side === "left" ? styles.actionLeft : styles.actionRight]}>
      <Pressable style={styles.actionPressable} onPress={onPress}>
        <LinearGradient
          colors={colorsRange}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.actionGradient}
        >
          <Ionicons name={icon} size={22} color="#FFFFFF" />
          <Text style={styles.actionLabel}>{label}</Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  swipeContainer: {
    borderRadius: radii.card,
    overflow: "hidden",
    marginBottom: spacing.sm,
  },
  card: { marginBottom: 0 },
  habitName: { ...typography.body, fontWeight: "700", marginBottom: 2 },
  habitSubtitle: { ...typography.caption },
  habitReminder: { ...typography.caption, color: colors.softAccent, marginTop: 2 },
  action: { width: ACTION_WIDTH },
  actionLeft: { alignItems: "flex-start" },
  actionRight: { alignItems: "flex-end" },
  actionPressable: { width: ACTION_WIDTH, height: "100%" },
  actionGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: { ...typography.caption, color: "#FFFFFF", fontWeight: "700", marginTop: 4 },
});

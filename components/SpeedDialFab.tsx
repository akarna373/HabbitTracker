import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import { Animated, BackHandler, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { colors, spacing, typography } from "../lib/theme";

const FAB_SIZE = 56;
const FAB_MOVE_UP = 40; // extra push up from the screen's bottom edge
const FAB_MOVE_LEFT = 0; // slid back right by the same 40 it was moved left before
const FAB_RIGHT = spacing.lg + FAB_MOVE_LEFT;
const FAB_BOTTOM = spacing.lg + FAB_MOVE_UP;
const CARD_W = 170; // same width for all three - fits "Recurring task" on one line with room to spare
const CARD_H = 44; // fixed pill-button height
const GAP = 14; // uniform gap - between the FAB and the first tile, and between every tile after that
const HORIZONTAL_OFFSET = 24; // extra push left, away from the FAB's own column, for every tile
const VERTICAL_OFFSET = HORIZONTAL_OFFSET * 2; // extra push up, for every tile
const TRAVEL_DISTANCE = 14; // small nudge in the tile's enter direction - the wave "pushing" it into place, not a slide-in
const DURATION = 300;
const STAGGER_MS = 40; // wavefront reaches Habit, then Recurring, then Task, 40ms apart
const ITEM_ANIM_FRACTION = 0.6; // each item's own reveal takes ~60% of the total transition - fast, settles before the wave finishes
const GLOW_PADDING = 20;

function hapticLight() {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Device/emulator without haptic support - ignore.
  }
}

function hapticConfirm() {
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Device/emulator without haptic support - ignore.
  }
}

interface DialAction {
  id: string;
  title: string;
  enabled: boolean;
  onSelect?: () => void;
  // Where this tile ends up, and which edge it enters from. "up": same row
  // as the FAB, arrives sliding up from below the screen. "left": stacked
  // above the FAB, arrives sliding in from the left.
  right: number;
  bottom: number;
  enter: "up" | "left";
}

// Recurring/Task keep stacking straight above the FAB, GAP apart, starting
// GAP above the FAB's own top edge - same uniform gap throughout.
function stackBottom(stackIndex: number): number {
  return FAB_BOTTOM + FAB_SIZE + GAP + stackIndex * (CARD_H + GAP);
}

// Recurring task / Task aren't built yet - the "why" belongs in code, not on
// screen (see the removed "Current release" card this replaces).
function buildActions(close: () => void): DialAction[] {
  return [
    {
      id: "habit",
      title: "Habit",
      enabled: true,
      onSelect: () => {
        close();
        router.push("/habit/categories");
      },
      // Same row as the FAB, offset further left than a bare touching gap.
      right: FAB_RIGHT + FAB_SIZE + GAP + HORIZONTAL_OFFSET,
      bottom: FAB_BOTTOM + VERTICAL_OFFSET,
      enter: "up",
    },
    {
      id: "recurring",
      title: "Recurring task",
      enabled: false,
      // Mid tile - pushed one more HORIZONTAL_OFFSET past the other two.
      right: FAB_RIGHT + HORIZONTAL_OFFSET + HORIZONTAL_OFFSET,
      bottom: stackBottom(0) + VERTICAL_OFFSET,
      enter: "left",
    },
    {
      id: "task",
      title: "Task",
      enabled: false,
      // Slid back right by one HORIZONTAL_OFFSET, toward the FAB's column.
      right: FAB_RIGHT,
      bottom: stackBottom(1) + VERTICAL_OFFSET,
      enter: "left",
    },
  ];
}

// Farthest corner any tile reaches from the FAB center, across every tile's
// final position - the glow must cover at least this. Scaled up beyond the
// bare minimum so the shade reads as a real backdrop halo, not a shrink-wrap
// that just barely reaches the last tile's edge.
const GLOW_EXPANSION = 1.5;
function computeGlowRadius(): number {
  const fabCenterRight = FAB_RIGHT + FAB_SIZE / 2;
  const fabCenterBottom = FAB_BOTTOM + FAB_SIZE / 2;
  let maxDist = 0;
  for (const a of buildActions(() => {})) {
    const dx = a.right + CARD_W - fabCenterRight;
    const dy = a.bottom + CARD_H - fabCenterBottom;
    maxDist = Math.max(maxDist, Math.sqrt(dx * dx + dy * dy));
  }
  return maxDist * GLOW_EXPANSION + GLOW_PADDING;
}
const GLOW_RADIUS = computeGlowRadius();
const GLOW_DIAMETER = GLOW_RADIUS * 2;

export function SpeedDialFab() {
  // "open" is the logical/interactive state (icon rotation, back-button,
  // tap targets). "mounted" is the render-presence state - it flips to true
  // the instant opening starts, but only flips back to false once the
  // closing Animated.timing actually finishes, so the backdrop and options
  // stay in the tree (and visible mid-animation) for their whole exit
  // transition instead of vanishing the moment `open` becomes false.
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;

  const setOpenState = (next: boolean) => {
    hapticLight();
    setOpen(next);
    if (next) {
      setMounted(true);
      Animated.timing(progress, {
        toValue: 1,
        duration: DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(progress, {
        toValue: 0,
        duration: DURATION,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  };

  const actions = buildActions(() => setOpenState(false));

  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setOpenState(false);
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleActionPress = (action: DialAction) => {
    if (action.enabled) {
      hapticConfirm();
      action.onSelect?.();
    } else {
      hapticLight();
    }
  };

  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "45deg"] });
  const backdropOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const glowScale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });

  return (
    <>
      {mounted ? (
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpenState(false)}>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropOpacity }]} pointerEvents="none">
            <View style={styles.dim} />
            <Animated.View style={[styles.glowGroup, { transform: [{ scale: glowScale }] }]}>
              <Svg width={GLOW_DIAMETER} height={GLOW_DIAMETER}>
                <Defs>
                  <RadialGradient id="fabGlow" cx="50%" cy="50%" r="50%">
                    <Stop offset="0%" stopColor={colors.accentPink} stopOpacity={0.12} />
                    <Stop offset="55%" stopColor={colors.accentPink} stopOpacity={0.07} />
                    <Stop offset="100%" stopColor={colors.accentPink} stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Circle cx={GLOW_RADIUS} cy={GLOW_RADIUS} r={GLOW_RADIUS} fill="url(#fabGlow)" />
              </Svg>
            </Animated.View>
          </Animated.View>
        </Pressable>
      ) : null}

      <View style={styles.dialContainer} pointerEvents="box-none">
        {mounted
          ? actions.map((action, i) => {
              const start = Math.min(1, (i * STAGGER_MS) / DURATION);
              const end = Math.min(1, start + ITEM_ANIM_FRACTION);
              const itemProgress = progress.interpolate({
                inputRange: [0, start, end, 1],
                outputRange: [0, 0, 1, 1],
                extrapolate: "clamp",
              });
              const opacity = itemProgress;
              // Tile is already sitting at its final `right`/`bottom` - the
              // wavefront just reveals it in place with a small nudge along
              // its own entry axis and a gentle scale-up, not a slide across
              // the screen. Reversing progress reverses the same path back.
              const scale = itemProgress.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
              const translateX = itemProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [action.enter === "left" ? -TRAVEL_DISTANCE : 0, 0],
              });
              const translateY = itemProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [action.enter === "up" ? TRAVEL_DISTANCE : 0, 0],
              });

              return (
                <Animated.View
                  key={action.id}
                  style={[
                    styles.actionCardWrap,
                    {
                      right: action.right,
                      bottom: action.bottom,
                      opacity,
                      transform: [{ translateX }, { translateY }, { scale }],
                    },
                  ]}
                  pointerEvents={open ? "auto" : "none"}
                >
                  <Pressable onPress={() => handleActionPress(action)}>
                    {({ pressed }) => (
                      <View style={[styles.actionCard, pressed && styles.actionCardPressed]}>
                        <Text style={styles.actionTitle} numberOfLines={1} ellipsizeMode="tail">
                          {action.title}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                </Animated.View>
              );
            })
          : null}

        <Pressable style={styles.fab} onPress={() => setOpenState(!open)}>
          <Animated.Text style={[styles.fabText, { transform: [{ rotate }] }]}>+</Animated.Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  dim: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.55)" },
  // Sized/positioned so this wrapper's own center is the FAB's center -
  // scaling it (transform-origin defaults to an element's own center in RN)
  // expands/contracts around the FAB instead of around the screen.
  glowGroup: {
    position: "absolute",
    width: GLOW_DIAMETER,
    height: GLOW_DIAMETER,
    right: FAB_RIGHT - (GLOW_DIAMETER - FAB_SIZE) / 2,
    bottom: FAB_BOTTOM - (GLOW_DIAMETER - FAB_SIZE) / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  dialContainer: { position: "absolute", right: 0, bottom: 0, left: 0, top: 0 },
  fab: {
    position: "absolute",
    right: FAB_RIGHT,
    bottom: FAB_BOTTOM,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: colors.accentPink,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.accentPink,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
  },
  fabText: { fontSize: 28, color: colors.background, fontWeight: "700", marginTop: -2 },
  actionCardWrap: { position: "absolute" },
  actionCard: {
    width: CARD_W,
    height: CARD_H,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: CARD_H / 2, // pill shape, reads as a real button instead of a label chip
    backgroundColor: "rgba(31,27,38,0.25)", // colors.surfaceRaised at 25% fill
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionCardPressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
  actionTitle: { ...typography.body, fontWeight: "700", color: colors.textPrimary, textAlign: "center" },
});

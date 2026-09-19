import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import { Animated, BackHandler, Easing, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { colors, spacing, typography } from "../lib/theme";

const FAB_SIZE = 56; // above the 48 dp minimum touch target; the whole circle is the button
// The standard bottom-right spot: 20 dp from the right edge, 16 dp above the bottom
// tab bar. The screens this sits on end right above the tab bar, which already
// keeps clear of the system navigation bar, so no bottom inset is added here; the
// right side adds its inset (landscape cutouts, gesture areas) at render time.
const FAB_RIGHT = 20;
const FAB_BOTTOM = 16;
// How much room a screen's content must leave at the bottom so nothing ends up
// under the button: its own bottom gap, its height and a little breathing room.
export const FAB_CLEARANCE = FAB_BOTTOM + FAB_SIZE + 16;
const SCREEN_MARGIN = 8; // menu tiles never come closer than this to the screen's left edge
const CARD_W = 170; // same width for all three - fits "Recurring task" on one line with room to spare
const CARD_H = 44; // fixed pill-button height
// The pill is 44 dp tall; 2 dp of tappable padding above and below make each option a
// 48 dp target (the wrapper moves down by the same amount, so the pill does not shift).
const ACTION_TOUCH_PAD = 2;
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
function stackBottom(fabBottom: number, stackIndex: number): number {
  return fabBottom + FAB_SIZE + GAP + stackIndex * (CARD_H + GAP);
}

// Recurring task / Task aren't built yet - the "why" belongs in code, not on
// screen (see the removed "Current release" card this replaces).
function buildActions(close: () => void, fabRight: number, fabBottom: number): DialAction[] {
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
      right: fabRight + FAB_SIZE + GAP + HORIZONTAL_OFFSET,
      bottom: fabBottom + VERTICAL_OFFSET,
      enter: "up",
    },
    {
      id: "recurring",
      title: "Recurring task",
      enabled: false,
      // Mid tile - pushed one more HORIZONTAL_OFFSET past the other two.
      right: fabRight + HORIZONTAL_OFFSET + HORIZONTAL_OFFSET,
      bottom: stackBottom(fabBottom, 0) + VERTICAL_OFFSET,
      enter: "left",
    },
    {
      id: "task",
      title: "Task",
      enabled: false,
      // Slid back right by one HORIZONTAL_OFFSET, toward the FAB's column.
      right: fabRight,
      bottom: stackBottom(fabBottom, 1) + VERTICAL_OFFSET,
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
  for (const a of buildActions(() => {}, FAB_RIGHT, FAB_BOTTOM)) {
    const dx = a.right + CARD_W - fabCenterRight;
    const dy = a.bottom + CARD_H - fabCenterBottom;
    maxDist = Math.max(maxDist, Math.sqrt(dx * dx + dy * dy));
  }
  return maxDist * GLOW_EXPANSION + GLOW_PADDING;
}
const GLOW_RADIUS = computeGlowRadius();
const GLOW_DIAMETER = GLOW_RADIUS * 2;

export function SpeedDialFab() {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const fabRight = FAB_RIGHT + insets.right;
  const fabBottom = FAB_BOTTOM;
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

  // The menu opens up and to the left of the button; on a narrow screen the tiles are
  // pulled right just enough that none crosses the left edge.
  const actions = buildActions(() => setOpenState(false), fabRight, fabBottom).map((action) => ({
    ...action,
    right: Math.max(fabRight, Math.min(action.right, screenWidth - CARD_W - SCREEN_MARGIN)),
  }));

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
        <Pressable style={[StyleSheet.absoluteFill, styles.backdrop]} onPress={() => setOpenState(false)}>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropOpacity }]} pointerEvents="none">
            <View style={styles.dim} />
            <Animated.View
              style={[
                styles.glowGroup,
                {
                  right: fabRight - (GLOW_DIAMETER - FAB_SIZE) / 2,
                  bottom: fabBottom - (GLOW_DIAMETER - FAB_SIZE) / 2,
                  transform: [{ scale: glowScale }],
                },
              ]}
            >
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
                      bottom: action.bottom - ACTION_TOUCH_PAD,
                      opacity,
                      transform: [{ translateX }, { translateY }, { scale }],
                    },
                  ]}
                  pointerEvents={open ? "auto" : "none"}
                >
                  <Pressable onPress={() => handleActionPress(action)} style={styles.actionTouch}>
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

        <Pressable style={[styles.fab, { right: fabRight, bottom: fabBottom }]} onPress={() => setOpenState(!open)}>
          <Animated.Text style={[styles.fabText, { transform: [{ rotate }] }]}>+</Animated.Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  // Above every card and tile behind it, with the button and its menu above the backdrop.
  backdrop: { zIndex: 1000 },
  dim: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.55)" },
  // Sized/positioned so this wrapper's own center is the FAB's center -
  // scaling it (transform-origin defaults to an element's own center in RN)
  // expands/contracts around the FAB instead of around the screen.
  glowGroup: {
    position: "absolute",
    width: GLOW_DIAMETER,
    height: GLOW_DIAMETER,
    alignItems: "center",
    justifyContent: "center",
  },
  dialContainer: { position: "absolute", right: 0, bottom: 0, left: 0, top: 0, zIndex: 1001 },
  fab: {
    position: "absolute",
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
  actionTouch: { paddingVertical: ACTION_TOUCH_PAD },
  actionCard: {
    width: CARD_W,
    height: CARD_H,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: CARD_H / 2, // pill shape, reads as a real button instead of a label chip
    // Near-opaque so nothing on the dashboard shows through, even in bright light:
    // colors.surfaceRaised at 90%, with a colors.accentPink outline at 30%.
    backgroundColor: "rgba(31,27,38,0.9)",
    borderWidth: 1,
    borderColor: "rgba(255,79,139,0.3)",
    shadowColor: "#000000",
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  actionCardPressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
  actionTitle: { ...typography.body, fontWeight: "700", color: colors.textPrimary, textAlign: "center" },
});

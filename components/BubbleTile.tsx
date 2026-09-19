import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, type LayoutChangeEvent, type ViewStyle } from "react-native";
import { spacing } from "../lib/theme";
import { BubbleBackground, type BubbleZone } from "./BubbleBackground";

export const BUBBLE_TILE_RADIUS = 22;

interface BubbleTileProps {
  children: ReactNode;
  variant?: 0 | 1;
  // When given, the whole tile is one button.
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  // Extra space kept clear on the right of the content (e.g. for the floating + button).
  rightGutter?: number;
  bubbleZone?: BubbleZone;
  onLayout?: (event: LayoutChangeEvent) => void;
  style?: ViewStyle;
}

// The card used for the Today screen's Habits and Upcoming Tasks tiles: a black-grey
// bubble texture behind the content, a thin light edge and a soft shadow for depth.
export function BubbleTile({
  children,
  variant = 0,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  rightGutter = 0,
  bubbleZone,
  onLayout,
  style,
}: BubbleTileProps) {
  const body = (
    <View style={[styles.tile, style]} onLayout={onLayout}>
      <BubbleBackground variant={variant} radius={BUBBLE_TILE_RADIUS} zone={bubbleZone} avoidFab />
      <View style={[styles.content, { paddingRight: spacing.md + rightGutter }]}>{children}</View>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: { alignSelf: "stretch" },
  tile: {
    borderRadius: BUBBLE_TILE_RADIUS,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    backgroundColor: "#1b1b20",
    shadowColor: "#000000",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  content: { paddingLeft: spacing.md, paddingVertical: 12 },
  pressed: { opacity: 0.92 },
});


import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { colors, spacing } from "../lib/theme";

export const DASHBOARD_TILE_RADIUS = 22;
// Every tile is at least this tall, so Habits and Upcoming Tasks match; content is
// centered vertically inside.
export const DASHBOARD_TILE_HEIGHT = 84;

interface DashboardTileProps {
  children: ReactNode;
  // Big faint icon drawn behind the content, bottom-right.
  watermark?: React.ComponentProps<typeof Ionicons>["name"];
  // When given, the whole tile is one button.
  onPress?: () => void;
  accessibilityLabel?: string;
}

// The card used for Today's Habits and Upcoming Tasks tiles. Dark plum-to-black
// gradient, a soft pink glow in the top-right corner, a lit top edge, a pink accent
// bar on the left and an oversized tilted icon watermark - so it reads as part of
// the Habbit brand, not as a plain grey box. Everything decorative ignores touches.
export function DashboardTile({ children, watermark, onPress, accessibilityLabel }: DashboardTileProps) {
  const body = (
    <View style={styles.tile}>
      <LinearGradient
        colors={["#261B2E", "#15111B", "#0F0D14"]}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id="glow" cx="0.92" cy="0.05" r="0.8" gradientUnits="objectBoundingBox">
            <Stop offset="0" stopColor={colors.accentPink} stopOpacity={0.3} />
            <Stop offset="0.55" stopColor={colors.accentPink} stopOpacity={0.07} />
            <Stop offset="1" stopColor={colors.accentPink} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#glow)" />
      </Svg>
      {watermark ? (
        <Ionicons name={watermark} size={104} color={colors.accentPink} style={styles.watermark} pointerEvents="none" />
      ) : null}
      <LinearGradient
        colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.22)", "rgba(255,255,255,0)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.topEdge}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[colors.softAccent, colors.accentPink]}
        style={styles.accentBar}
        pointerEvents="none"
      />
      <View style={styles.content}>{children}</View>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: { alignSelf: "stretch" },
  tile: {
    borderRadius: DASHBOARD_TILE_RADIUS,
    minHeight: DASHBOARD_TILE_HEIGHT,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#15111B",
    shadowColor: "#000000",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  watermark: { position: "absolute", right: -14, bottom: -22, opacity: 0.1, transform: [{ rotate: "-14deg" }] },
  topEdge: { position: "absolute", top: 0, left: 24, right: 24, height: 1 },
  accentBar: { position: "absolute", left: 10, top: 18, bottom: 18, width: 3, borderRadius: 2 },
  content: { flexGrow: 1, justifyContent: "center", paddingLeft: spacing.md + 8, paddingRight: spacing.md, paddingVertical: 12 },
  pressed: { opacity: 0.92 },
});

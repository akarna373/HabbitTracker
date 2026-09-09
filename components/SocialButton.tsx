import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing } from "../lib/theme";

interface SocialButtonProps {
  title: string;
  icon: ReactNode;
  onPress: () => void;
}

// Google brand colours, used for the gradient border stripe.
const BORDER_COLORS = ["#4285F4", "#EA4335", "#FBBC05", "#34A853"] as const;

// Visual only for now - no auth wired up yet.
export function SocialButton({ title, icon, onPress }: SocialButtonProps) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.pressable}>
      {({ pressed }) => (
        <LinearGradient
          colors={BORDER_COLORS}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.borderWrap, pressed && styles.pressed]}
        >
          <View style={styles.button}>
            <View style={styles.icon}>{icon}</View>
            <Text style={styles.text}>{title}</Text>
          </View>
        </LinearGradient>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    width: "100%",
    borderRadius: radii.button,
    overflow: "hidden",
    marginBottom: spacing.sm,
  },
  borderWrap: {
    width: "100%",
    borderRadius: radii.button,
    padding: 1.5,
  },
  button: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.button - 1.5,
    paddingVertical: spacing.md,
    backgroundColor: colors.surfaceRaised,
  },
  pressed: { opacity: 0.85 },
  icon: { marginRight: spacing.sm },
  text: { color: colors.textPrimary, fontSize: 16, fontWeight: "700" },
});

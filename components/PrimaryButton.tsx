import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { colors, radii, spacing } from "../lib/theme";

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "outline";
  disabled?: boolean;
  loading?: boolean;
}

export function PrimaryButton({ title, onPress, variant = "primary", disabled, loading }: PrimaryButtonProps) {
  const isOutline = variant === "outline";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      hitSlop={8}
      android_ripple={{ color: isOutline ? "rgba(255,79,139,0.25)" : "rgba(0,0,0,0.15)" }}
      style={({ pressed }) => [
        styles.button,
        isOutline ? styles.outline : styles.primary,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isOutline ? colors.accentPink : colors.background} />
      ) : (
        <Text style={[styles.text, isOutline && styles.outlineText]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: "100%",
    borderRadius: radii.button,
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  primary: { backgroundColor: colors.accentPink },
  // A literal "transparent" background can make Android only hit-test the
  // painted child (the text), not the full view bounds - use a near-invisible
  // real color instead so the whole pill is tappable.
  outline: { backgroundColor: "rgba(11,10,15,0.01)", borderWidth: 1, borderColor: colors.accentPink },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  text: { color: colors.background, fontSize: 16, fontWeight: "700" },
  outlineText: { color: colors.accentPink },
});

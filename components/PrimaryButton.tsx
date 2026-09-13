import { useRef } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { colors, radii, spacing } from "../lib/theme";

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "outline";
  size?: "default" | "small";
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export function PrimaryButton({ title, onPress, variant = "primary", size = "default", disabled, loading, style }: PrimaryButtonProps) {
  const isOutline = variant === "outline";
  const isSmall = size === "small";
  const isHandling = useRef(false);

  const handlePress = async () => {
    if (isHandling.current) return;
    isHandling.current = true;
    try {
      await onPress();
    } finally {
      isHandling.current = false;
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      hitSlop={12}
      // Android can "flatten" a Pressable with no independent visual props
      // into its parent's view tree, which can shrink its real touch region
      // down to whatever child (like the Text) still renders its own bounds.
      // Force it to stay a real, independent native view.
      collapsable={false}
      style={({ pressed }) => [
        styles.button,
        isOutline ? styles.outline : styles.primary,
        isSmall && styles.small,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isOutline ? colors.accentPink : colors.background} />
      ) : (
        <Text style={[styles.text, isOutline && styles.outlineText, isSmall && styles.smallText]}>{title}</Text>
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
  small: {
    width: "auto",
    alignSelf: "center",
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  text: { color: colors.background, fontSize: 16, fontWeight: "700" },
  outlineText: { color: colors.accentPink },
  smallText: { fontSize: 13 },
});

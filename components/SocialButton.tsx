import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text } from "react-native";
import { colors, radii, spacing } from "../lib/theme";

interface SocialButtonProps {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}

// Visual only for now - no auth wired up yet.
export function SocialButton({ title, icon, onPress }: SocialButtonProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <Ionicons name={icon} size={20} color={colors.textPrimary} style={styles.icon} />
      <Text style={styles.text}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.button,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    marginBottom: spacing.sm,
  },
  pressed: { opacity: 0.85 },
  icon: { marginRight: spacing.sm },
  text: { color: colors.textPrimary, fontSize: 16, fontWeight: "700" },
});

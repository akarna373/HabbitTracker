import { Pressable, StyleSheet, View, ViewStyle } from "react-native";
import { colors, radii, spacing } from "../lib/theme";

interface CardProps {
  children: React.ReactNode;
  highlighted?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Card({ children, highlighted, onPress, onLongPress, disabled, style }: CardProps) {
  const content = (
    <View
      style={[
        styles.card,
        highlighted && styles.highlighted,
        disabled && styles.disabled,
        style,
      ]}
    >
      {children}
    </View>
  );

  if (!onPress && !onLongPress) return content;

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      onLongPress={disabled ? undefined : onLongPress}
      disabled={disabled}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  highlighted: {
    borderColor: colors.accentPink,
  },
  disabled: {
    opacity: 0.5,
  },
});

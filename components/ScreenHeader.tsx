import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../lib/theme";

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
}

export function ScreenHeader({ title, subtitle, onBack }: ScreenHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Pressable
          onPress={onBack ?? (() => router.back())}
          hitSlop={12}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backArrow}>←</Text>
        </Pressable>
        <Text style={styles.title}>{title}</Text>
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  backButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center", marginLeft: -6 },
  backArrow: { fontSize: 22, color: colors.textPrimary },
  title: { ...typography.screenTitle, flexShrink: 1 },
  subtitle: { ...typography.caption, marginTop: spacing.xs, marginLeft: spacing.xs },
});

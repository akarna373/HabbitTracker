import { StyleSheet, Text, View } from "react-native";
import { Card } from "./Card";
import { colors, spacing, typography } from "../lib/theme";

interface ListRowProps {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  disabled?: boolean;
  showChevron?: boolean;
  highlighted?: boolean;
  right?: React.ReactNode;
}

export function ListRow({ title, subtitle, onPress, disabled, showChevron = true, highlighted, right }: ListRowProps) {
  return (
    <Card onPress={onPress} disabled={disabled} highlighted={highlighted}>
      <View style={styles.row}>
        <View style={styles.textCol}>
          <Text style={[styles.title, disabled && styles.disabledText]}>{title}</Text>
          {subtitle ? <Text style={[styles.subtitle, disabled && styles.disabledText]}>{subtitle}</Text> : null}
        </View>
        {right ? right : showChevron && onPress ? <Text style={styles.chevron}>›</Text> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  textCol: { flexShrink: 1, paddingRight: spacing.sm },
  title: { ...typography.body, fontWeight: "600" },
  subtitle: { ...typography.caption, marginTop: 2 },
  disabledText: { color: colors.textMuted },
  chevron: { fontSize: 20, color: colors.accentPink },
});

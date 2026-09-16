import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "../components/Card";
import { ScreenHeader } from "../components/ScreenHeader";
import type { CalendarType } from "../lib/calendarSettings";
import { useStore } from "../lib/store";
import { colors, spacing, typography } from "../lib/theme";

const OPTIONS: { type: CalendarType; title: string; subtitle: string }[] = [
  { type: "gregorian", title: "Gregorian", subtitle: "The standard international calendar" },
  { type: "bikram_sambat", title: "Bikram Sambat", subtitle: "Nepali calendar - Baisakh to Chaitra" },
];

export default function CalendarSettingsScreen() {
  const calendarType = useStore((s) => s.calendarType);
  const setCalendarType = useStore((s) => s.setCalendarType);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title="Calendar" subtitle="Used anywhere a habit's schedule is shown as dates." />
      <ScrollView contentContainerStyle={styles.content}>
        {OPTIONS.map((opt) => {
          const active = calendarType === opt.type;
          return (
            <Pressable key={opt.type} onPress={() => setCalendarType(opt.type)}>
              <Card highlighted={active}>
                <View style={styles.row}>
                  <View style={styles.textCol}>
                    <Text style={styles.rowTitle}>{opt.title}</Text>
                    <Text style={styles.rowSubtitle}>{opt.subtitle}</Text>
                  </View>
                  {active ? <Text style={styles.check}>{"✓"}</Text> : null}
                </View>
              </Card>
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  textCol: { flex: 1, paddingRight: spacing.sm },
  rowTitle: { ...typography.body, fontWeight: "700" },
  rowSubtitle: { ...typography.caption, marginTop: 2 },
  check: { ...typography.body, color: colors.accentPink, fontWeight: "700" },
});

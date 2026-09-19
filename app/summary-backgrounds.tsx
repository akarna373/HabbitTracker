import { useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PrimaryButton } from "../components/PrimaryButton";
import { ScreenHeader } from "../components/ScreenHeader";
import { SUMMARY_BACKGROUNDS } from "../components/summaryBackgrounds/registry";
import { addDays, todayISO } from "../lib/dates";
import { isNotificationTestEnabled } from "../lib/notifications";
import { saveSummaryBackground } from "../lib/summaryBackgroundStorage";
import { useStore } from "../lib/store";
import { SUMMARY_CARD_RADIUS } from "../lib/summaryTheme";
import { colors, spacing, typography } from "../lib/theme";

// Preview of every Summary background (not linked from the app - open it with
// habittracker://summary-backgrounds). Test builds can tap a tile to preview it
// on the Today card, and also get a button that makes
// the stored selection two days old and then runs the real refresh, so the
// crossfade on the Today card can be watched without waiting for a new period.
export default function SummaryBackgroundGalleryScreen() {
  const current = useStore((s) => s.summaryBackground);
  const refresh = useStore((s) => s.refreshSummaryBackground);

  const simulateNewPeriod = () => {
    useStore.setState({ summaryBackground: { index: current.index, date: addDays(todayISO(), -2) } });
    refresh();
  };

  // Test builds: tapping a tile puts that scene on the Today card (and saves it,
  // exactly as a real selection would be).
  const preview = (index: number) => {
    if (!isNotificationTestEnabled()) return;
    const selection = { index, date: todayISO() };
    saveSummaryBackground(selection);
    useStore.setState({ summaryBackground: selection });
  };

  // habittracker://summary-backgrounds?preview=10 puts scene #10 on the card.
  const { preview: previewParam } = useLocalSearchParams<{ preview?: string }>();
  useEffect(() => {
    const number = Number(previewParam);
    if (Number.isInteger(number) && number >= 1 && number <= SUMMARY_BACKGROUNDS.length) preview(number - 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewParam]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader
        title="Summary backgrounds"
        subtitle={`Now showing #${current.index + 1}: ${SUMMARY_BACKGROUNDS[current.index]?.name ?? "-"} (since ${current.date})`}
      />
      <FlatList
        data={SUMMARY_BACKGROUNDS}
        keyExtractor={(entry) => entry.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          isNotificationTestEnabled() ? (
            <PrimaryButton title="Simulate a new two-day period" variant="outline" size="small" onPress={simulateNewPeriod} />
          ) : null
        }
        renderItem={({ item, index }) => (
          <Pressable onPress={() => preview(index)} style={[styles.tile, index === current.index && styles.tileActive]}>
            <item.Scene />
            <View style={styles.label}>
              <Text style={styles.labelText}>
                {index + 1}. {item.name}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  tile: { height: 230, borderRadius: SUMMARY_CARD_RADIUS, overflow: "hidden", marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border, backgroundColor: "#141026" },
  tileActive: { borderColor: colors.accentPink, borderWidth: 2 },
  label: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.md, paddingVertical: 8, backgroundColor: "rgba(10,8,14,0.6)" },
  labelText: { ...typography.body, fontWeight: "700" },
});

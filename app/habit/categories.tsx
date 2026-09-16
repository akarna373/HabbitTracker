import { router } from "expo-router";
import { useEffect } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ListRow } from "../../components/ListRow";
import { ScreenHeader } from "../../components/ScreenHeader";
import { useDraftStore } from "../../lib/draftStore";
import { CATEGORIES } from "../../lib/templates";
import { colors, spacing } from "../../lib/theme";

export default function CategoriesScreen() {
  const set = useDraftStore((s) => s.set);
  const reset = useDraftStore((s) => s.reset);

  // This is the entry point for the main "+" flow (the old add-activity.tsx,
  // which did this same reset, was replaced by the FAB speed dial) - without
  // it, an abandoned previous attempt's leftover fields (price, exam date,
  // etc.) would bleed into the next one.
  useEffect(() => {
    reset();
  }, [reset]);

  const choose = (categoryId: string) => {
    if (categoryId === "quit") {
      set({ kind: "quit", category: categoryId });
      router.push("/habit/quit-templates");
    } else if (categoryId === "health") {
      set({ kind: "good", category: categoryId });
      router.push("/habit/health-templates");
    } else if (categoryId === "fitness") {
      set({ kind: "good", category: categoryId });
      router.push("/habit/fitness-templates");
    } else if (categoryId === "study") {
      set({ kind: "good", category: categoryId });
      router.push("/habit/study-templates");
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title="Choose your direction" subtitle="Start with one small change." />
      <ScrollView contentContainerStyle={styles.content}>
        {CATEGORIES.map((cat) => (
          <ListRow
            key={cat.id}
            title={cat.title}
            subtitle={cat.subtitle}
            disabled={!cat.enabled}
            showChevron={cat.enabled}
            onPress={cat.enabled ? () => choose(cat.id) : undefined}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
});

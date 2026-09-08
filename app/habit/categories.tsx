import { router } from "expo-router";
import { ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ListRow } from "../../components/ListRow";
import { ScreenHeader } from "../../components/ScreenHeader";
import { useDraftStore } from "../../lib/draftStore";
import { CATEGORIES } from "../../lib/templates";
import { colors, spacing } from "../../lib/theme";

export default function CategoriesScreen() {
  const set = useDraftStore((s) => s.set);

  const choose = (categoryId: string) => {
    if (categoryId === "quit") {
      set({ kind: "quit", category: categoryId });
      router.push("/habit/quit-templates");
    } else if (categoryId === "good") {
      set({ kind: "good", category: categoryId });
      router.push("/habit/good-templates");
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

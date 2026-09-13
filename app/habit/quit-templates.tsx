import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ListRow } from "../../components/ListRow";
import { PrimaryButton } from "../../components/PrimaryButton";
import { ScreenHeader } from "../../components/ScreenHeader";
import { TemplateIcon } from "../../components/TemplateIcon";
import { useDraftStore } from "../../lib/draftStore";
import { useStore } from "../../lib/store";
import { CUSTOM_QUIT_TEMPLATE_ID, QUIT_TEMPLATES } from "../../lib/templates";
import { colors, spacing, typography } from "../../lib/theme";

export default function QuitTemplatesScreen() {
  const set = useDraftStore((s) => s.set);
  const habits = useStore((s) => s.habits);
  // Avoid duplicates: a template already used for an existing quit habit
  // can't be picked again.
  const usedTemplateIds = new Set(habits.filter((h) => h.kind === "quit").map((h) => h.templateId));

  const chooseTemplate = (templateId: string) => {
    const template = QUIT_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    set({
      templateId: template.id,
      name: template.name,
      trackingMethod: "amount",
      unit: template.unit,
      hasCost: template.hasCost,
      baselineQuantity: null,
      pricePerItem: null,
      targetAmount: null,
      suggestedBaselineQuantity: template.hasCost ? template.defaultBaselineQuantity : null,
      suggestedPricePerItem: template.hasCost ? template.defaultPricePerItem : null,
      suggestedTargetAmount: template.hasCost ? null : template.defaultBaselineQuantity,
      goalType: template.hasCost ? "reduce" : null,
      summaryTime: template.hasCost ? "22:00" : null,
    });
    router.push(template.hasCost ? "/habit/smoking-setup" : "/habit/basics");
  };

  const chooseCustom = () => {
    set({
      templateId: CUSTOM_QUIT_TEMPLATE_ID,
      name: "",
      trackingMethod: "amount",
      targetAmount: null,
      suggestedTargetAmount: null,
      unit: null,
      hasCost: false,
      baselineQuantity: null,
      pricePerItem: null,
      suggestedBaselineQuantity: null,
      suggestedPricePerItem: null,
      goalType: null,
      summaryTime: null,
    });
    router.push("/habit/basics");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title="Quit a bad habit" subtitle="Choose a starting point without judgment." />
      <ScrollView contentContainerStyle={styles.content}>
        {QUIT_TEMPLATES.map((t) => {
          const alreadyAdded = usedTemplateIds.has(t.id);
          return (
            <ListRow
              key={t.id}
              title={t.name}
              subtitle={alreadyAdded ? "Already tracking this" : t.description}
              icon={<TemplateIcon set={t.iconSet} name={t.icon} />}
              disabled={alreadyAdded}
              showChevron={!alreadyAdded}
              onPress={alreadyAdded ? undefined : () => chooseTemplate(t.id)}
            />
          );
        })}
        <PrimaryButton title="Create a custom quit habit" variant="outline" onPress={chooseCustom} />
        <Pressable style={styles.skip} onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.skipText}>None of these — skip for now</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  skip: { alignItems: "center", paddingVertical: spacing.md },
  skipText: { ...typography.caption, color: colors.textSecondary, textDecorationLine: "underline" },
});

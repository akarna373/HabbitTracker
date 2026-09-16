import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ListRow } from "../../components/ListRow";
import { PrimaryButton } from "../../components/PrimaryButton";
import { ScreenHeader } from "../../components/ScreenHeader";
import { TemplateIcon } from "../../components/TemplateIcon";
import { useDraftStore } from "../../lib/draftStore";
import { useStore } from "../../lib/store";
import { CUSTOM_HEALTH_TEMPLATE_ID, HEALTH_TEMPLATES } from "../../lib/templates";
import { colors, spacing, typography } from "../../lib/theme";

export default function HealthTemplatesScreen() {
  const set = useDraftStore((s) => s.set);
  const habits = useStore((s) => s.habits);
  // Avoid duplicates: a template already used for an existing health habit
  // can't be picked again - except Medication, since real people take more
  // than one medicine at once and each needs its own habit.
  const usedTemplateIds = new Set(
    habits.filter((h) => h.category === "health" && h.templateId !== "medication").map((h) => h.templateId)
  );

  const chooseTemplate = (templateId: string) => {
    const template = HEALTH_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    set({
      templateId: template.id,
      // Medication's own name field is free-form (this drives the cycling
      // placeholder) - every other template still prefills its generic name.
      name: template.id === "medication" ? "" : template.name,
      trackingMethod: template.trackingMethod ?? "amount",
      targetAmount: null,
      suggestedTargetAmount: template.targetAmount,
      unit: template.unit,
      microtasks: template.microtasks,
      hasCost: !!template.hasCost,
      pricePerItem: null,
      suggestedPricePerItem: template.defaultPricePerItem ?? null,
      doseAmount: null,
      doseUnit: null,
      dosageFrequency: null,
      durationType: null,
      medicineCategory: null,
      ...(template.id === "medication" ? { reminderEnabled: true, reminderTime: "08:00" } : null),
    });
    router.push("/habit/basics");
  };

  const chooseCustom = () => {
    set({
      templateId: CUSTOM_HEALTH_TEMPLATE_ID,
      name: "",
      trackingMethod: "amount",
      targetAmount: null,
      suggestedTargetAmount: null,
      unit: null,
      microtasks: [],
      hasCost: false,
      pricePerItem: null,
      suggestedPricePerItem: null,
      doseAmount: null,
      doseUnit: null,
      dosageFrequency: null,
      durationType: null,
      medicineCategory: null,
    });
    router.push("/habit/basics");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title="Health" subtitle="Manage a condition, track what it costs." />
      <ScrollView contentContainerStyle={styles.content}>
        {HEALTH_TEMPLATES.map((t) => {
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
        <PrimaryButton title="Create a custom health habit" variant="outline" onPress={chooseCustom} />
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

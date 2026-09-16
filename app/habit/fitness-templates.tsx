import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ListRow } from "../../components/ListRow";
import { PrimaryButton } from "../../components/PrimaryButton";
import { ScreenHeader } from "../../components/ScreenHeader";
import { TemplateIcon } from "../../components/TemplateIcon";
import { useDraftStore } from "../../lib/draftStore";
import { useStore } from "../../lib/store";
import { CUSTOM_FITNESS_TEMPLATE_ID, FITNESS_TEMPLATES } from "../../lib/templates";
import { colors, spacing, typography } from "../../lib/theme";

export default function FitnessTemplatesScreen() {
  const set = useDraftStore((s) => s.set);
  const habits = useStore((s) => s.habits);
  // Avoid duplicates: a template already used for an existing fitness habit
  // can't be picked again. "personal_goal" is the older category id the
  // onboarding focus-setup chip still uses for this same screen.
  const usedTemplateIds = new Set(
    habits.filter((h) => h.category === "fitness" || h.category === "personal_goal").map((h) => h.templateId)
  );

  const chooseTemplate = (templateId: string) => {
    const template = FITNESS_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    // The morning-walk reminder is the whole point of this template - start
    // the user with it already on, at a sensible morning time, instead of
    // the generic 8:30 PM default they'd otherwise have to notice and fix.
    const isWalking = template.id === "walking_jogging";
    set({
      templateId: template.id,
      name: template.name,
      trackingMethod: template.trackingMethod ?? "amount",
      targetAmount: null,
      suggestedTargetAmount: template.targetAmount,
      unit: template.unit,
      microtasks: template.microtasks,
      hasCost: false,
      ...(isWalking ? { reminderEnabled: true, reminderTime: "08:00" } : null),
    });
    router.push("/habit/basics");
  };

  const chooseCustom = () => {
    set({
      templateId: CUSTOM_FITNESS_TEMPLATE_ID,
      name: "",
      trackingMethod: "amount",
      targetAmount: null,
      suggestedTargetAmount: null,
      unit: null,
      microtasks: [],
      hasCost: false,
    });
    router.push("/habit/basics");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title="Fitness" subtitle="Small habits that add up to a healthier you." />
      <ScrollView contentContainerStyle={styles.content}>
        {FITNESS_TEMPLATES.map((t) => {
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
        <PrimaryButton title="Create a custom fitness habit" variant="outline" onPress={chooseCustom} />
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

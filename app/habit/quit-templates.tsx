import { router } from "expo-router";
import { ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ListRow } from "../../components/ListRow";
import { PrimaryButton } from "../../components/PrimaryButton";
import { ScreenHeader } from "../../components/ScreenHeader";
import { TemplateIcon } from "../../components/TemplateIcon";
import { useDraftStore } from "../../lib/draftStore";
import { CUSTOM_QUIT_TEMPLATE_ID, QUIT_TEMPLATES } from "../../lib/templates";
import { colors, spacing } from "../../lib/theme";

export default function QuitTemplatesScreen() {
  const set = useDraftStore((s) => s.set);

  const chooseTemplate = (templateId: string) => {
    const template = QUIT_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    set({
      templateId: template.id,
      name: template.name,
      trackingMethod: "amount",
      unit: template.unit,
      hasCost: template.hasCost,
      baselineQuantity: template.hasCost ? template.defaultBaselineQuantity : null,
      pricePerItem: template.hasCost ? template.defaultPricePerItem : null,
      targetAmount: template.hasCost ? null : template.defaultBaselineQuantity,
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
      unit: null,
      hasCost: false,
      baselineQuantity: null,
      pricePerItem: null,
      goalType: null,
      summaryTime: null,
    });
    router.push("/habit/basics");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title="Quit a bad habit" subtitle="Choose a starting point without judgment." />
      <ScrollView contentContainerStyle={styles.content}>
        {QUIT_TEMPLATES.map((t) => (
          <ListRow
            key={t.id}
            title={t.name}
            subtitle={t.description}
            icon={<TemplateIcon set={t.iconSet} name={t.icon} />}
            onPress={() => chooseTemplate(t.id)}
          />
        ))}
        <PrimaryButton title="Create a custom quit habit" variant="outline" onPress={chooseCustom} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
});

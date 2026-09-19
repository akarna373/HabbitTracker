import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { formatMoneyCompact } from "../lib/currency";
import { todayISO } from "../lib/dates";
import { useFinancialSummary } from "../lib/financialSummarySelectors";
import { buildReflectionCards } from "../lib/reflection";
import { buildShareCard } from "../lib/shareCard";
import { canShareImages, captureCard, saveImageToGallery, shareImage } from "../lib/shareImage";
import { useStore } from "../lib/store";
import { summaryColors } from "../lib/summaryTheme";
import { colors, spacing, typography } from "../lib/theme";
import { useMinuteClock } from "../lib/useMinuteClock";
import { PrimaryButton } from "./PrimaryButton";
import { ShareCard, SHARE_CARD_ASPECT } from "./ShareCard";

type Notice = { kind: "ok" | "error"; text: string } | null;

const MAX_PREVIEW_WIDTH = 320;

// A preview of the progress card with two actions: share it with any app, or save it to the gallery.
// The card is built from the same numbers as the dashboard, with no names on it (lib/shareCard.ts).
export function ShareSheet({ onClose }: { onClose: () => void }) {
  const summary = useFinancialSummary();
  const habits = useStore((s) => s.habits);
  const logsByHabit = useStore((s) => s.logsByHabit);
  const calendarType = useStore((s) => s.calendarType);
  const monthlyGoal = useStore((s) => s.financialSettings.monthlyGoal);
  const { today } = useMinuteClock();
  const { width: windowWidth } = useWindowDimensions();

  const reflectionCards = useMemo(() => buildReflectionCards({ habits, logsByHabit, today }), [habits, logsByHabit, today]);
  const data = useMemo(
    () => buildShareCard({ summary, monthlyGoal, reflectionCards, calendarType, formatMoney: formatMoneyCompact }),
    [summary, monthlyGoal, reflectionCards, calendarType]
  );

  const cardRef = useRef<View>(null);
  const [busy, setBusy] = useState<"share" | "save" | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const previewWidth = Math.min(windowWidth - spacing.lg * 2, MAX_PREVIEW_WIDTH);

  // A change of card (the day rolled over, say) clears an old message.
  useEffect(() => setNotice(null), [data]);

  const capture = () => captureCard(cardRef, `habbit-progress-${todayISO()}`);

  const onShare = async () => {
    if (busy) return;
    setBusy("share");
    setNotice(null);
    try {
      if (!(await canShareImages())) {
        setNotice({ kind: "error", text: "Sharing isn't available on this phone." });
        return;
      }
      await shareImage(await capture());
    } catch {
      setNotice({ kind: "error", text: "Couldn't share the picture. Please try again." });
    } finally {
      setBusy(null);
    }
  };

  const onSave = async () => {
    if (busy) return;
    setBusy("save");
    setNotice(null);
    try {
      const result = await saveImageToGallery(await capture());
      if (result === "saved") setNotice({ kind: "ok", text: "Saved to your photos." });
      else if (result === "denied") setNotice({ kind: "error", text: "Allow photo access to save it, or use Share instead." });
      else setNotice({ kind: "error", text: "Couldn't save the picture. Please try again." });
    } catch {
      setNotice({ kind: "error", text: "Couldn't save the picture. Please try again." });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Share your progress</Text>

          {data ? (
            <>
              {/* collapsable={false} keeps this a real native view, which the capture needs. */}
              <View ref={cardRef} collapsable={false} style={{ width: previewWidth, height: previewWidth * SHARE_CARD_ASPECT }}>
                <ShareCard data={data} width={previewWidth} />
              </View>
              <Text style={styles.privacy}>Only numbers and the Habbit name are on this picture. No names, habits or places.</Text>

              <View style={styles.buttons}>
                <PrimaryButton title="Share" loading={busy === "share"} disabled={busy !== null} onPress={onShare} />
                <PrimaryButton title="Save to photos" variant="outline" loading={busy === "save"} disabled={busy !== null} onPress={onSave} />
              </View>
              {notice ? <Text style={[styles.notice, notice.kind === "ok" ? styles.noticeOk : styles.noticeError]}>{notice.text}</Text> : null}
            </>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Nothing to share yet</Text>
              <Text style={styles.emptyBody}>
                Log a day, or build a streak, and your progress card appears here, ready to share.
              </Text>
            </View>
          )}

          <Pressable onPress={onClose} hitSlop={12} style={styles.close} accessibilityRole="button" accessibilityLabel="Close">
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.78)" },
  content: { flexGrow: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.xl },
  title: { ...typography.screenTitle, marginBottom: spacing.md },
  privacy: { ...typography.caption, textAlign: "center", marginTop: spacing.md, maxWidth: MAX_PREVIEW_WIDTH },
  buttons: { alignSelf: "stretch", maxWidth: MAX_PREVIEW_WIDTH, marginTop: spacing.md },
  notice: { marginTop: spacing.sm, textAlign: "center", fontWeight: "600" },
  noticeOk: { color: summaryColors.saved },
  noticeError: { color: colors.accentRed },
  empty: { maxWidth: MAX_PREVIEW_WIDTH, alignItems: "center", paddingVertical: spacing.lg },
  emptyTitle: { ...typography.body, fontWeight: "700", marginBottom: spacing.xs },
  emptyBody: { ...typography.caption, textAlign: "center", lineHeight: 19 },
  close: { marginTop: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  closeText: { ...typography.body, color: colors.textSecondary, fontWeight: "600" },
});

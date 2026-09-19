import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { formatTime12h } from "../lib/progress";
import { useStore } from "../lib/store";
import { summaryColors } from "../lib/summaryTheme";
import { colors, spacing, typography } from "../lib/theme";
import { buildUpcomingTasks, type UpcomingKind, type UpcomingTask } from "../lib/upcomingTasks";
import { useMinuteClock } from "../lib/useMinuteClock";
import { BubbleTile } from "./BubbleTile";

// The floating + button (SpeedDialFab): 56 dp wide, 24 dp from the screen edge. The
// tile keeps its text this far from the right edge so the button never covers any.
export const FAB_CLEARANCE = 56 + 12;

const ROW_HEIGHT = 26;
const HEADER_HEIGHT = 22;
const HEADER_GAP = 4;
const CHROME_HEIGHT = 12 * 2 + HEADER_HEIGHT + HEADER_GAP; // top + bottom padding, header row, gap under it

const KIND_ICON: Record<UpcomingKind, React.ComponentProps<typeof Ionicons>["name"]> = {
  reminder: "alarm-outline",
  dose: "medkit-outline",
  checkup: "medical-outline",
  exam: "school-outline",
};

// Today's reminders in one place: habit reminders still open, medication doses not
// yet taken, and checkups / exams coming up. The tile fills whatever height Today
// leaves it and shows as many one-line rows as fit; tapping a row opens that habit.
export function UpcomingTasksTile() {
  const habits = useStore((s) => s.habits);
  const logsByHabit = useStore((s) => s.logsByHabit);
  const { today, nowMinutes } = useMinuteClock();
  const [height, setHeight] = useState(0);

  const tasks = useMemo(
    () => buildUpcomingTasks({ habits, logsByHabit, today, nowMinutes }),
    [habits, logsByHabit, today, nowMinutes]
  );

  const rowsThatFit = Math.max(1, Math.floor((height - CHROME_HEIGHT) / ROW_HEIGHT));
  // With room for three or more rows, the last one becomes "+N more" when not
  // everything fits. Below that every row is a real task and the badge in the header
  // carries the total, so nothing is silently cut off.
  const needsMoreRow = tasks.length > rowsThatFit && rowsThatFit >= 3;
  const shown = tasks.slice(0, needsMoreRow ? rowsThatFit - 1 : rowsThatFit);
  const hidden = tasks.length - shown.length;

  const onLayout = (event: LayoutChangeEvent) => setHeight(Math.round(event.nativeEvent.layout.height));

  return (
    <BubbleTile variant={1} rightGutter={FAB_CLEARANCE} bubbleZone={{ dp: FAB_CLEARANCE + spacing.md }} onLayout={onLayout} style={styles.tile}>
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <Ionicons name="notifications-outline" size={20} color={colors.accentPink} />
          <Text style={styles.title}>Upcoming Tasks</Text>
        </View>
        {tasks.length > 0 ? (
          <View style={styles.badge} accessibilityLabel={`${tasks.length} upcoming`}>
            <Text style={styles.badgeText}>{tasks.length}</Text>
          </View>
        ) : null}
      </View>

      {tasks.length === 0 ? (
        <Text style={styles.empty} numberOfLines={2}>
          {habits.length === 0 ? "Reminders and doses you set up will show here." : "You're all clear - nothing left for today."}
        </Text>
      ) : (
        <View>
          {shown.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
          {needsMoreRow ? (
            <View style={styles.row}>
              <Text style={styles.more}>+{hidden} more today</Text>
            </View>
          ) : null}
        </View>
      )}
    </BubbleTile>
  );
}

function TaskRow({ task }: { task: UpcomingTask }) {
  const earlier = task.status === "earlier";
  const label = `${task.title}. ${task.detail}${task.time ? `, ${earlier ? "earlier at" : "at"} ${formatTime12h(task.time)}` : ""}`;
  return (
    <Pressable
      onPress={() => router.push(`/habit/${task.habitId}`)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.whenCol}>
        {task.time ? (
          <Text style={[styles.time, earlier && styles.timeEarlier]} numberOfLines={1}>
            {formatTime12h(task.time)}
          </Text>
        ) : (
          <Ionicons name={KIND_ICON[task.kind]} size={17} color={colors.accentPink} />
        )}
      </View>
      <Text style={styles.line} numberOfLines={1}>
        <Text style={styles.taskTitle}>{task.title}</Text>
        <Text style={[styles.detail, earlier && styles.detailEarlier]}>{`  ${earlier ? "earlier - " : ""}${task.detail}`}</Text>
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Takes all the height Today has left.
  tile: { flex: 1, minHeight: 96 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: HEADER_HEIGHT, marginBottom: HEADER_GAP },
  titleGroup: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { ...typography.screenTitle, fontSize: 18, ...summaryColors.textShadow },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: "center", justifyContent: "center", backgroundColor: colors.accentPink },
  badgeText: { color: colors.background, fontSize: 12, fontWeight: "800" },
  empty: { ...typography.body, color: summaryColors.textDim },
  row: { flexDirection: "row", alignItems: "center", height: ROW_HEIGHT },
  rowPressed: { opacity: 0.7 },
  whenCol: { width: 70, justifyContent: "center" },
  time: { color: colors.accentPink, fontSize: 13, fontWeight: "800" },
  timeEarlier: { color: summaryColors.textDim },
  line: { flex: 1 },
  taskTitle: { ...typography.body, fontWeight: "700" },
  detail: { ...typography.caption, color: summaryColors.textDim },
  detailEarlier: { fontStyle: "italic" },
  more: { ...typography.caption, color: summaryColors.textDim },
});

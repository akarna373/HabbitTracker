import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "../components/ScreenHeader";
import { formatTime12h } from "../lib/progress";
import { useStore } from "../lib/store";
import { colors, spacing, typography } from "../lib/theme";
import { buildUpcomingTasks, type UpcomingKind, type UpcomingTask } from "../lib/upcomingTasks";
import { useMinuteClock } from "../lib/useMinuteClock";

const KIND_ICON: Record<UpcomingKind, React.ComponentProps<typeof Ionicons>["name"]> = {
  reminder: "alarm-outline",
  dose: "medkit-outline",
  checkup: "medical-outline",
  exam: "school-outline",
};

// Everything the habits still ask of you: reminders still open today, medication
// doses not yet taken (both timed, so first), then checkups and exams coming up.
// Tapping a row opens that habit.
export default function UpcomingTasksScreen() {
  const habits = useStore((s) => s.habits);
  const logsByHabit = useStore((s) => s.logsByHabit);
  const { today, nowMinutes } = useMinuteClock();

  const tasks = useMemo(
    () => buildUpcomingTasks({ habits, logsByHabit, today, nowMinutes }),
    [habits, logsByHabit, today, nowMinutes]
  );
  const todayTasks = tasks.filter((task) => task.time !== null);
  const comingUp = tasks.filter((task) => task.time === null);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader
        title="Upcoming Tasks"
        subtitle={tasks.length === 0 ? undefined : `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"} to do`}
      />
      <ScrollView contentContainerStyle={styles.list}>
        {tasks.length === 0 ? (
          <Text style={styles.empty}>
            {habits.length === 0 ? "Reminders and doses you set up will show here." : "You're all clear - nothing left for today."}
          </Text>
        ) : null}
        <Section title="Left today" tasks={todayTasks} />
        <Section title="Coming up" tasks={comingUp} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, tasks }: { title: string; tasks: UpcomingTask[] }) {
  if (tasks.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {tasks.map((task) => (
        <TaskRow key={task.id} task={task} />
      ))}
    </View>
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
          <Ionicons name={KIND_ICON[task.kind]} size={20} color={colors.accentPink} />
        )}
      </View>
      <View style={styles.body}>
        <Text style={styles.taskTitle} numberOfLines={1}>
          {task.title}
        </Text>
        <Text style={[styles.detail, earlier && styles.detailEarlier]} numberOfLines={1}>
          {`${earlier ? "earlier - " : ""}${task.detail}`}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  empty: { ...typography.body, color: colors.textSecondary, marginTop: spacing.md },
  section: { marginTop: spacing.md },
  sectionTitle: { ...typography.caption, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: spacing.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rowPressed: { opacity: 0.7 },
  whenCol: { width: 70, justifyContent: "center" },
  time: { color: colors.accentPink, fontSize: 14, fontWeight: "800" },
  timeEarlier: { color: colors.textSecondary },
  body: { flex: 1 },
  taskTitle: { ...typography.body, fontWeight: "700" },
  detail: { ...typography.caption, marginTop: 2 },
  detailEarlier: { fontStyle: "italic" },
});

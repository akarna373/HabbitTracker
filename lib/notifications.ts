// expo-notifications throws on import inside Expo Go (SDK 53+ removed the module
// there entirely, not just remote push). Load it defensively so the rest of the
// app still works in Expo Go; real scheduling only happens in a dev/prod build.
let Notifications: typeof import("expo-notifications") | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Notifications = require("expo-notifications");
  Notifications?.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
} catch {
  Notifications = null;
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (!Notifications) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

function parseTime(time: string): { hour: number; minute: number } {
  const [hour, minute] = time.split(":").map(Number);
  return { hour, minute };
}

export async function scheduleDailyNotification(
  title: string,
  body: string,
  time: string
): Promise<string | null> {
  if (!Notifications) return null;
  const granted = await ensureNotificationPermission();
  if (!granted) return null;
  const { hour, minute } = parseTime(time);
  return Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

export async function cancelNotification(id: string | null): Promise<void> {
  if (!Notifications || !id) return;
  await Notifications.cancelScheduledNotificationAsync(id);
}

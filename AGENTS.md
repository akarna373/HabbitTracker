# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Notification test button

Each habit's detail screen has a bell "Test" button that fires that habit's real notification(s) about 5 seconds later (content, category, channel and data come from `lib/notificationContent.ts`, the same builders the real schedulers use). It shows only when `isNotificationTestEnabled()` is true: any dev build (`__DEV__`), or a release/preview build compiled with `EXPO_PUBLIC_ENABLE_NOTIFICATION_TEST=1`. Production builds must not set that variable. Example preview build: `EXPO_PUBLIC_ENABLE_NOTIFICATION_TEST=1 npx expo run:android --variant release`. Logs are prefixed `[notif-test]`.

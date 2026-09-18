# Habbit — Progress Log

Last updated: 2026-09-17. This file exists so project state survives a
`/clear` (conversation wipe) — update it before clearing, not after.

## What's built (5-category plan: Quit / Health / Fitness / Study / Projects)

- **Quit habits** (smoking, alcohol, pan masala, custom): Counter, cost
  tracking, goals (reduce/quit-completely/track-only), "Motivate me" urge
  screen, smoking-hotspot location deterrent (foreground + background
  location), per-substance copy via `lib/templates.ts`'s `getQuitCopy`.
- **Health**: full Medication feature (dosage frequency, duration, course
  calendar, stock tracking + low-stock alert, dose reminders). Vitals log,
  doctor checkups (check-in style).
- **Fitness**: walking/jogging (check-in + morning reminder), weightloss
  journey (dual-metric weight/waist).
- **Study**: exam countdown, syllabus progress, attendance tracker.
- **Projects**: category exists but disabled (`enabled: false` in
  `lib/templates.ts` CATEGORIES) — not yet brainstormed or built.
- Speed-dial FAB, swipe-to-archive/delete, theme is dark-only for now
  (light/dark deferred until the app is fully built — see
  `project_theme_deferred` memory).

## Notification actions — current state (as of commit 2145c3c)

Three notification categories with inline action buttons:
1. **Hotspot deterrent** (quit habits) — "I {verb}" / "I didn't" / "Dismiss".
2. **Medication dose** — "I took it" / "Dismiss".
3. **Morning walk** — "I went for a walk".

**Known-fixed, NOT YET CONFIRMED on device:** buttons were visible but not
clickable on the first release build (2026-09-17, 11:11 APK) — root cause
was `opensAppToForeground: false` on all actions, which means the JS
listener never runs if the app process was killed since the notification
fired (this app has no background task registered for notification
responses, unlike geofencing which does). Fixed by switching every
logic-bearing action to `opensAppToForeground: true` (Dismiss stays
`false` — it's a pure no-op, needs no JS). Shipped in the 12:41 and 13:31
release builds. **Nobody has tapped a button on either build yet** — this
is the #1 thing to verify before trusting notifications further.

Architecture note: forcing foreground is a workaround, not the ideal
design — tapping "I smoked" now visibly opens the app instead of logging
silently in the background. The right long-term fix (a real background
task for notification responses) hasn't been built.

## Build artifacts

- Release APK: `android/app/build/outputs/apk/release/app-release.apk`
  (rebuild with `cd android && ./gradlew assembleRelease` from repo root's
  `android/` dir — local Gradle build, NOT EAS cloud, per explicit user
  preference to avoid consuming EAS credits).
- Debug APK variant does NOT embed the JS bundle (expects a reachable
  Metro server) — don't use it for standalone install/test. Release
  variant bundles JS at build time and is fully standalone.
- Expo Go (`npx expo start`, port 8081) works for everything EXCEPT
  `expo-notifications` — that module isn't available in Expo Go on SDK 53+,
  only in a real build.
- Debug and release APKs use different signing configs — installing one
  over the other requires uninstalling the old variant first. Two release
  builds in a row (same variant) install fine over each other.

## Process lessons (why this file exists)

- Long chat sessions degrade via `/compact` (summarization) — facts get
  fuzzy, and it's easy to stack a new feature on top of something that was
  never actually confirmed working. That happened once already: the
  medication dynamic-reminder feature got built before the hotspot-button
  click fix was confirmed on-device.
- Rule going forward: **don't add a new feature on top of a "kind of
  works" one.** Confirm on-device first.
- `/clear` wipes all conversational memory; only git commits, this file,
  `CLAUDE.md`/`AGENTS.md`, and the auto-memory system survive it. Update
  this file before clearing if anything load-bearing changed.

## Next steps

1. **Verify notification action buttons actually work** on the current
   release build (hotspot YES/NO/Dismiss, medication "I took it", walk
   "I went for a walk") — confirm each one opens the app and the DB write
   actually lands (Counter/stock/streak updates correctly after).
2. A plan exists (not yet started) for editing a medication's dosage
   frequency/start date after creation — see
   `C:\Users\Abhijeet\.claude\plans\woolly-questing-wreath.md`.
3. Projects category still needs brainstorming before it can be built.

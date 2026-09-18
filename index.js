// Custom app entry (package.json "main"). expo-router loads screen files lazily,
// only once it renders - but when Android starts the app headlessly (a
// notification button tapped or a geofence event while the app is killed) no
// screen ever renders. These modules define the background tasks, so they must
// be evaluated here, before the router, or the headless runtime logs
// "No task registered for key expo-task-manager" and the task never runs.
import "./lib/notifications";
import "./lib/geofencing";

import "expo-router/entry";

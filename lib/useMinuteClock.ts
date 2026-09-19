import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { isoDate } from "./dates";

export interface MinuteClock {
  today: string; // local "YYYY-MM-DD"
  nowMinutes: number; // minutes since local midnight
}

function read(): MinuteClock {
  const now = new Date();
  return { today: isoDate(now), nowMinutes: now.getHours() * 60 + now.getMinutes() };
}

// The local date and time of day, refreshed every minute and whenever the app
// comes back to the foreground - so a task's "earlier" flag and the date roll over
// on their own. Only re-renders when the minute actually changed.
export function useMinuteClock(): MinuteClock {
  const [clock, setClock] = useState(read);

  useEffect(() => {
    const tick = () =>
      setClock((previous) => {
        const next = read();
        return next.today === previous.today && next.nowMinutes === previous.nowMinutes ? previous : next;
      });
    const timer = setInterval(tick, 30_000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") tick();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);

  return clock;
}

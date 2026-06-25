import { useEffect, useRef, useState } from "react";
import type { AirportWithStatus, RiskLevel } from "../lib/types";

export interface RiskAlert {
  id: string;
  icao: string;
  name: string;
  city: string;
  level: RiskLevel;
  score: number;
  factors: string[];
  timestamp: number;
}

const ALERT_LEVELS = new Set<RiskLevel>(["HIGH", "SEVERE"]);
const MAX_ALERTS = 5;
const AUTO_DISMISS_MS = 10_000;

function hasNotificationApi() {
  return typeof window !== "undefined" && "Notification" in window;
}

/**
 * Fires an alert when an airport's risk *escalates* into HIGH/SEVERE from a
 * lower level — not on every periodic update while it stays elevated, and
 * not on initial load (the first snapshot is the baseline, not an alert).
 */
export function useRiskAlerts(airports: AirportWithStatus[]) {
  const previousLevels = useRef<Map<string, RiskLevel>>(new Map());
  const initialized = useRef(false);
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    hasNotificationApi() && Notification.permission === "granted"
  );

  useEffect(() => {
    if (airports.length === 0) return;

    if (!initialized.current) {
      for (const a of airports) {
        if (a.risk) previousLevels.current.set(a.icao, a.risk.level);
      }
      initialized.current = true;
      return;
    }

    const newAlerts: RiskAlert[] = [];
    for (const a of airports) {
      if (!a.risk) continue;
      const prevLevel = previousLevels.current.get(a.icao) ?? "LOW";
      const wasElevated = ALERT_LEVELS.has(prevLevel);
      const isElevated = ALERT_LEVELS.has(a.risk.level);
      if (isElevated && !wasElevated) {
        newAlerts.push({
          id: `${a.icao}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          icao: a.icao,
          name: a.name,
          city: a.city,
          level: a.risk.level,
          score: a.risk.score,
          factors: a.risk.factors,
          timestamp: Date.now(),
        });
      }
      previousLevels.current.set(a.icao, a.risk.level);
    }

    if (newAlerts.length === 0) return;

    setAlerts((prev) => [...newAlerts, ...prev].slice(0, MAX_ALERTS));

    for (const alert of newAlerts) {
      setTimeout(() => {
        setAlerts((prev) => prev.filter((a) => a.id !== alert.id));
      }, AUTO_DISMISS_MS);
    }

    if (notificationsEnabled && hasNotificationApi()) {
      for (const alert of newAlerts) {
        new Notification(`${alert.level} delay risk — ${alert.icao}`, {
          body: `${alert.name}, ${alert.city} · score ${alert.score}/100\n${alert.factors[0] ?? ""}`,
          tag: alert.icao,
        });
      }
    }
  }, [airports, notificationsEnabled]);

  function dismiss(id: string) {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }

  async function enableNotifications() {
    if (!hasNotificationApi()) return;
    const permission = await Notification.requestPermission();
    setNotificationsEnabled(permission === "granted");
  }

  return { alerts, dismiss, notificationsEnabled, enableNotifications };
}

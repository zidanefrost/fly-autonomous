import { useState } from "react";
import { SUBSCRIBE_FLIGHT_WATCH_URL } from "../lib/workerUrls";

export interface SubscribeResult {
  ok: boolean;
  notified?: boolean;
  current_level?: string;
  reason?: string;
}

export function useFlightWatch() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SubscribeResult | null>(null);

  async function subscribe(
    phone: string,
    departureIcao: string,
    arrivalIcao: string | null,
    departureTimeIso: string
  ) {
    if (!SUBSCRIBE_FLIGHT_WATCH_URL) {
      setResult({ ok: false, reason: "Worker not configured (VITE_WORKER_BASE_URL unset)." });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const resp = await fetch(SUBSCRIBE_FLIGHT_WATCH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          departure_icao: departureIcao,
          arrival_icao: arrivalIcao || undefined,
          departure_time: departureTimeIso,
        }),
      });
      const data = (await resp.json()) as SubscribeResult;
      setResult(data);
    } catch {
      setResult({ ok: false, reason: "Could not reach the notification service." });
    } finally {
      setLoading(false);
    }
  }

  return { loading, result, subscribe };
}

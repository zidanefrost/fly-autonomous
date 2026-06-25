import { useState } from "react";
import type { RiskLevel } from "../lib/types";
import { FLIGHT_FORECAST_URL } from "../lib/workerUrls";

export interface ForecastLeg {
  icao: string;
  score: number;
  level: RiskLevel;
  factors: string[];
}

export interface ForecastResult {
  available: boolean;
  reason?: string;
  departure?: ForecastLeg;
  arrival?: ForecastLeg | null;
  overall_score?: number;
  overall_level?: RiskLevel;
  checkin_advice?: { lead_time: string; message: string };
  hours_until_departure?: number;
}

export function useFlightForecast() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ForecastResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function getForecast(departureIcao: string, arrivalIcao: string | null, departureTimeIso: string) {
    if (!FLIGHT_FORECAST_URL) {
      setError("Worker not configured (VITE_WORKER_BASE_URL unset) — cannot fetch a forecast.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const resp = await fetch(FLIGHT_FORECAST_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departure_icao: departureIcao,
          arrival_icao: arrivalIcao || undefined,
          departure_time: departureTimeIso,
        }),
      });
      const data = (await resp.json()) as ForecastResult;
      setResult(data);
    } catch {
      setError("Could not reach the forecast service. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setResult(null);
    setError(null);
  }

  return { loading, result, error, getForecast, reset };
}

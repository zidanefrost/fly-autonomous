import { useCallback, useEffect, useState } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { isLiveDataConfigured, supabase } from "../lib/supabaseClient";
import { applyScenario, buildMockAirports, pickEscalatedScenario } from "../lib/mockData";
import type { AirportWithStatus, DelayRisk, WeatherObservation } from "../lib/types";

// In mock mode there's no live weather feed to react to, so the in-dashboard
// alert system (which fires on risk *escalation*) would otherwise never have
// anything to demo. This periodically promotes one random airport to a
// HIGH/SEVERE scenario, purely so the alert path is exercisable without a
// real Supabase project. It only runs when no live data source is configured.
const MOCK_ESCALATION_INTERVAL_MS = 12_000;

export function useAirports() {
  const [airports, setAirports] = useState<AirportWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchAll = useCallback(async () => {
    if (!supabase) {
      setAirports(buildMockAirports());
      setLastRefreshed(new Date());
      setLoading(false);
      return;
    }

    const [{ data: airportsData }, { data: weatherData }, { data: riskData }] = await Promise.all([
      supabase.from("airports").select("*"),
      supabase.from("weather_observations").select("*"),
      supabase.from("delay_risk").select("*"),
    ]);

    const weatherByIcao = new Map((weatherData ?? []).map((w) => [w.icao, w as WeatherObservation]));
    const riskByIcao = new Map((riskData ?? []).map((r) => [r.icao, r as DelayRisk]));

    const merged: AirportWithStatus[] = (airportsData ?? []).map((a) => ({
      ...a,
      weather: weatherByIcao.get(a.icao) ?? null,
      risk: riskByIcao.get(a.icao) ?? null,
    }));

    setAirports(merged);
    setLastRefreshed(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const client = supabase;
    if (!client) {
      const interval = setInterval(() => {
        setAirports((prev) => {
          if (prev.length === 0) return prev;
          const idx = Math.floor(Math.random() * prev.length);
          const escalated = applyScenario(prev[idx], pickEscalatedScenario());
          const next = [...prev];
          next[idx] = escalated;
          return next;
        });
        setLastRefreshed(new Date());
      }, MOCK_ESCALATION_INTERVAL_MS);
      return () => clearInterval(interval);
    }

    const channel = client
      .channel("risk-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "delay_risk" },
        (payload: RealtimePostgresChangesPayload<DelayRisk>) => {
          const updated = payload.new as DelayRisk;
          if (!updated?.icao) return;
          setAirports((prev) =>
            prev.map((a) => (a.icao === updated.icao ? { ...a, risk: updated } : a))
          );
          setLastRefreshed(new Date());
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "weather_observations" },
        (payload: RealtimePostgresChangesPayload<WeatherObservation>) => {
          const updated = payload.new as WeatherObservation;
          if (!updated?.icao) return;
          setAirports((prev) =>
            prev.map((a) => (a.icao === updated.icao ? { ...a, weather: updated } : a))
          );
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [fetchAll]);

  return {
    airports,
    loading,
    lastRefreshed,
    usingMockData: !isLiveDataConfigured,
    refetch: fetchAll,
  };
}

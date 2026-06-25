import { useState } from "react";
import { useAirports } from "./hooks/useAirports";
import { useRiskAlerts } from "./hooks/useRiskAlerts";
import { MapView } from "./components/MapView";
import { AirportTable } from "./components/AirportTable";
import { DetailPanel } from "./components/DetailPanel";
import { StatsBar } from "./components/StatsBar";
import { AiBriefingButton } from "./components/AiBriefingButton";
import { AlertToasts } from "./components/AlertToasts";
import { TRIGGER_REFRESH_URL } from "./lib/workerUrls";

function App() {
  const { airports, loading, lastRefreshed, usingMockData, refetch } = useAirports();
  const { alerts, dismiss, notificationsEnabled, enableNotifications } = useRiskAlerts(airports);
  const [selectedIcao, setSelectedIcao] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const selected = airports.find((a) => a.icao === selectedIcao) ?? null;

  async function handleRefresh() {
    setRefreshing(true);
    try {
      if (TRIGGER_REFRESH_URL) {
        await fetch(TRIGGER_REFRESH_URL, { method: "POST" });
        await new Promise((r) => setTimeout(r, 1500));
      }
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="flex h-screen flex-col bg-[#05070d] text-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="text-lg font-semibold tracking-tight">
            🛫 OTP Sentinel
          </div>
          <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-slate-400">
            Weather &amp; delay-risk monitor · {airports.length} airports
          </span>
          {usingMockData && (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300">
              Mock data — configure VITE_SUPABASE_URL for live data
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={enableNotifications}
            disabled={notificationsEnabled}
            className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/10 disabled:cursor-default disabled:opacity-60"
          >
            {notificationsEnabled ? "🔔 Alerts on" : "🔕 Enable alerts"}
          </button>
          <AiBriefingButton airports={airports} />
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/10 disabled:opacity-50"
          >
            {refreshing ? "Refreshing…" : "↻ Refresh"}
          </button>
          {lastRefreshed && (
            <span className="text-xs text-slate-500">
              Updated {lastRefreshed.toLocaleTimeString()}
            </span>
          )}
        </div>
      </header>

      <div className="border-b border-white/10 px-5 py-2.5">
        <StatsBar airports={airports} />
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center text-slate-500">
          Loading airport data…
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <div className="relative w-[58%] border-r border-white/10">
            <MapView airports={airports} selectedIcao={selectedIcao} onSelect={setSelectedIcao} />
          </div>
          <div className="w-[24%] border-r border-white/10 p-3">
            <AirportTable airports={airports} selectedIcao={selectedIcao} onSelect={setSelectedIcao} />
          </div>
          <div className="w-[18%]">
            <DetailPanel airport={selected} onClose={() => setSelectedIcao(null)} />
          </div>
        </div>
      )}

      <AlertToasts alerts={alerts} onDismiss={dismiss} onSelect={setSelectedIcao} />
    </div>
  );
}

export default App;

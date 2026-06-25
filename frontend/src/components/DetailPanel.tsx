import type { AirportWithStatus } from "../lib/types";
import { RiskBadge } from "./RiskBadge";

export function DetailPanel({
  airport,
  onClose,
}: {
  airport: AirportWithStatus | null;
  onClose: () => void;
}) {
  if (!airport) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-500">
        Select an airport on the map or in the table to see its weather and delay-risk detail.
      </div>
    );
  }

  const { weather, risk } = airport;

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-mono text-lg text-slate-100">
            {airport.icao} <span className="text-slate-500">/ {airport.iata}</span>
          </div>
          <div className="text-sm text-slate-400">
            {airport.name} — {airport.city}, {airport.country}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-slate-500 hover:bg-white/10 hover:text-slate-200"
          aria-label="Close detail panel"
        >
          ✕
        </button>
      </div>

      {risk ? (
        <div>
          <RiskBadge level={risk.level} score={risk.score} />
          <ul className="mt-3 space-y-1.5 text-sm text-slate-300">
            {risk.factors.map((f, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-slate-600">•</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 text-xs text-slate-500">
            Updated {new Date(risk.updated_at).toLocaleTimeString()}
          </div>
        </div>
      ) : (
        <div className="text-sm text-slate-500">No delay-risk data yet for this airport.</div>
      )}

      <div className="border-t border-white/10 pt-3">
        <div className="text-xs uppercase tracking-wide text-slate-500">Raw METAR</div>
        {weather?.raw_metar ? (
          <code className="mt-1 block rounded-md bg-black/40 p-2 font-mono text-xs text-slate-300">
            {weather.raw_metar}
          </code>
        ) : (
          <div className="mt-1 text-sm text-slate-500">No observation available.</div>
        )}
        {weather?.is_stale && (
          <div className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs text-amber-300">
            ⚠ This observation is stale (older than 90 minutes) — treat with caution.
          </div>
        )}
      </div>

      {weather && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Field label="Flight category" value={weather.flight_category ?? "—"} />
          <Field
            label="Wind"
            value={
              weather.wind_speed_kt != null
                ? `${weather.wind_dir ?? "—"}° @ ${weather.wind_speed_kt}kt${
                    weather.wind_gust_kt ? ` (gust ${weather.wind_gust_kt}kt)` : ""
                  }`
                : "—"
            }
          />
          <Field label="Visibility" value={weather.visibility_sm ? `${weather.visibility_sm} sm` : "—"} />
          <Field label="Weather" value={weather.weather_string ?? "none"} />
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/5 p-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-slate-200">{value}</div>
    </div>
  );
}

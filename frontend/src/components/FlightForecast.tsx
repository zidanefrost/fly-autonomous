import { useState } from "react";
import type { FormEvent } from "react";
import { motion } from "framer-motion";
import { AIRPORTS } from "../lib/airports";
import { RISK_COLORS } from "../lib/types";
import { useFlightForecast } from "../hooks/useFlightForecast";
import type { ForecastLeg } from "../hooks/useFlightForecast";
import { useFlightWatch } from "../hooks/useFlightWatch";
import { Reveal } from "./Reveal";

const SORTED_AIRPORTS = [...AIRPORTS].sort((a, b) => a.name.localeCompare(b.name));

function minDateTimeLocal(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

export function FlightForecast() {
  const [departure, setDeparture] = useState("");
  const [arrival, setArrival] = useState("");
  const [when, setWhen] = useState("");
  const { loading, result, error, getForecast } = useFlightForecast();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!departure || !when) return;
    getForecast(departure, arrival || null, new Date(when).toISOString());
  }

  return (
    <section className="border-t border-white/10 px-6 py-20">
      <div className="mx-auto max-w-2xl">
        <Reveal className="text-center">
          <h2 className="text-2xl font-bold text-slate-50 sm:text-3xl">
            Forecast your own flight
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-400">
            Pick a departure airport and time to get a 0–100 delay-risk forecast and
            advice on when to check in. Built on real TAF forecasts, which only cover
            roughly the next 24–30 hours — ask too far out and it'll say so honestly.
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          <form
            onSubmit={handleSubmit}
            className="mt-10 space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-left">
                <span className="text-xs uppercase tracking-wide text-slate-500">
                  Departure airport
                </span>
                <select
                  value={departure}
                  onChange={(e) => setDeparture(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/50 focus:outline-none"
                >
                  <option value="" disabled>
                    Select airport…
                  </option>
                  {SORTED_AIRPORTS.map((a) => (
                    <option key={a.icao} value={a.icao}>
                      {a.icao} — {a.name} ({a.city})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-left">
                <span className="text-xs uppercase tracking-wide text-slate-500">
                  Arrival airport (optional)
                </span>
                <select
                  value={arrival}
                  onChange={(e) => setArrival(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/50 focus:outline-none"
                >
                  <option value="">None</option>
                  {SORTED_AIRPORTS.map((a) => (
                    <option key={a.icao} value={a.icao}>
                      {a.icao} — {a.name} ({a.city})
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block text-left">
              <span className="text-xs uppercase tracking-wide text-slate-500">
                Scheduled departure (your local time)
              </span>
              <input
                type="datetime-local"
                value={when}
                min={minDateTimeLocal()}
                onChange={(e) => setWhen(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/50 focus:outline-none"
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-sky-500 to-sky-400 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:scale-[1.02] disabled:opacity-50"
            >
              {loading ? "Forecasting…" : "Get delay forecast"}
            </button>
          </form>
        </Reveal>

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300"
          >
            {error}
          </motion.div>
        )}

        {result && !result.available && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300"
          >
            {result.reason}
          </motion.div>
        )}

        {result?.available && result.overall_level && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6 text-left backdrop-blur-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  Overall delay-risk forecast
                </div>
                <div
                  className="mt-1 text-4xl font-bold"
                  style={{ color: RISK_COLORS[result.overall_level] }}
                >
                  {result.overall_score}/100
                </div>
                <div
                  className="text-sm font-semibold"
                  style={{ color: RISK_COLORS[result.overall_level] }}
                >
                  {result.overall_level}
                </div>
              </div>
              <div className="text-sm text-slate-500">
                {result.hours_until_departure}h until departure
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {result.departure && <LegCard title="Departure" leg={result.departure} />}
              {result.arrival && <LegCard title="Arrival" leg={result.arrival} />}
            </div>

            {result.checkin_advice && (
              <div className="mt-6 rounded-xl border border-sky-500/30 bg-sky-500/10 p-4">
                <div className="text-xs uppercase tracking-wide text-sky-300">
                  {result.checkin_advice.lead_time}
                </div>
                <p className="mt-1 text-sm text-slate-200">{result.checkin_advice.message}</p>
              </div>
            )}

            <WhatsAppOptIn
              departureIcao={departure}
              arrivalIcao={arrival || null}
              departureTimeIso={new Date(when).toISOString()}
            />
          </motion.div>
        )}
      </div>
    </section>
  );
}

function WhatsAppOptIn({
  departureIcao,
  arrivalIcao,
  departureTimeIso,
}: {
  departureIcao: string;
  arrivalIcao: string | null;
  departureTimeIso: string;
}) {
  const [phone, setPhone] = useState("");
  const { loading, result, subscribe } = useFlightWatch();

  function handleSubscribe(e: FormEvent) {
    e.preventDefault();
    if (!phone.trim()) return;
    subscribe(phone.trim(), departureIcao, arrivalIcao, departureTimeIso);
  }

  if (result?.ok) {
    return (
      <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
        {result.notified
          ? "You're set — a WhatsApp message is on its way, and we'll text you again if conditions change."
          : result.reason}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubscribe}
      className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex-1 text-left">
          <span className="text-xs uppercase tracking-wide text-slate-500">
            Get a WhatsApp update if this changes
          </span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+44 7xxx xxxxxx"
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/50 focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={loading || !phone.trim()}
          className="rounded-lg border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:scale-105 hover:bg-white/20 disabled:opacity-50"
        >
          {loading ? "…" : "Notify me"}
        </button>
      </div>
      {result && !result.ok && (
        <div className="mt-2 text-xs text-red-300">{result.reason}</div>
      )}
    </form>
  );
}

function LegCard({ title, leg }: { title: string; leg: ForecastLeg }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">
        {title} — {leg.icao}
      </div>
      <div className="mt-1 text-lg font-semibold" style={{ color: RISK_COLORS[leg.level] }}>
        {leg.level} · {leg.score}/100
      </div>
      <ul className="mt-2 space-y-1 text-xs text-slate-400">
        {leg.factors.map((f, i) => (
          <li key={i}>• {f}</li>
        ))}
      </ul>
    </div>
  );
}

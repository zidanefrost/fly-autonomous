import type { AirportWithStatus } from "../lib/types";

export function ProofStats({ airports }: { airports: AirportWithStatus[] }) {
  const reporting = airports.filter((a) => a.risk).length;
  const severe = airports.filter((a) => a.risk?.level === "SEVERE").length;
  const countries = new Set(airports.map((a) => a.country)).size;

  const stats = [
    { value: "102", label: "Airports monitored" },
    { value: String(countries), label: "Countries covered" },
    { value: String(reporting), label: "Reporting live now" },
    { value: String(severe), label: "SEVERE risk right now" },
    { value: "10 min", label: "Autonomous refresh cycle" },
  ];

  return (
    <section className="border-t border-white/10 px-6 py-14">
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-6 sm:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <div className="text-3xl font-bold text-slate-50 sm:text-4xl">{s.value}</div>
            <div className="mt-1 text-xs uppercase tracking-wide text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

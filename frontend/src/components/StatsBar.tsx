import type { AirportWithStatus, RiskLevel } from "../lib/types";
import { RISK_COLORS } from "../lib/types";

const LEVELS: RiskLevel[] = ["SEVERE", "HIGH", "MEDIUM", "LOW"];

export function StatsBar({ airports }: { airports: AirportWithStatus[] }) {
  const counts: Record<RiskLevel, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, SEVERE: 0 };
  let reporting = 0;
  for (const a of airports) {
    if (a.risk) {
      counts[a.risk.level]++;
      reporting++;
    }
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      {LEVELS.map((level) => (
        <div
          key={level}
          className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5"
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: RISK_COLORS[level] }}
          />
          <span className="font-medium text-slate-200">{counts[level]}</span>
          <span className="text-slate-400">{level}</span>
        </div>
      ))}
      <div className="ml-1 text-slate-500">
        {reporting}/{airports.length} reporting
      </div>
    </div>
  );
}

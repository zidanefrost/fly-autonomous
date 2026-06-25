import type { RiskLevel } from "../lib/types";
import { RISK_COLORS } from "../lib/types";

const PULSE_CLASS: Record<RiskLevel, string> = {
  LOW: "",
  MEDIUM: "",
  HIGH: "risk-pulse-amber",
  SEVERE: "risk-pulse",
};

export function RiskBadge({ level, score }: { level: RiskLevel; score?: number }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide ${PULSE_CLASS[level]}`}
      style={{
        color: RISK_COLORS[level],
        backgroundColor: `${RISK_COLORS[level]}1a`,
        border: `1px solid ${RISK_COLORS[level]}55`,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: RISK_COLORS[level] }}
      />
      {level}
      {typeof score === "number" && <span className="opacity-70">{score}</span>}
    </span>
  );
}

import { AIRPORTS } from "./airports";
import type { Airport, AirportWithStatus, RiskLevel } from "./types";

// Deterministic pseudo-random scenarios per airport so the dashboard looks
// the same on every reload (no flicker), used when no Supabase project is
// configured — lets the full UI be built/verified/demoed without cloud creds.

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

export interface Scenario {
  level: RiskLevel;
  score: number;
  flightCategory: string;
  factors: string[];
  raw: string;
  windDir: string;
  windSpeed: number;
  windGust: number | null;
  visibility: string;
  wxString: string | null;
}

export const SCENARIOS: Scenario[] = [
  {
    level: "LOW",
    score: 0,
    flightCategory: "VFR",
    factors: ["Clear conditions, no significant weather reported"],
    raw: "AUTO 09006KT 9999 NCD",
    windDir: "90",
    windSpeed: 6,
    windGust: null,
    visibility: "6+",
    wxString: null,
  },
  {
    level: "MEDIUM",
    score: 20,
    flightCategory: "MVFR",
    factors: ["Marginal visual flight rules (reduced ceiling/visibility)"],
    raw: "14008KT 5000 BR SCT018",
    windDir: "140",
    windSpeed: 8,
    windGust: null,
    visibility: "3.1",
    wxString: "BR",
  },
  {
    level: "MEDIUM",
    score: 38,
    flightCategory: "MVFR",
    factors: [
      "Marginal visual flight rules (reduced ceiling/visibility)",
      "Snow reported (SN)",
    ],
    raw: "32012KT 3200 -SN BKN012",
    windDir: "320",
    windSpeed: 12,
    windGust: null,
    visibility: "2.0",
    wxString: "-SN",
  },
  {
    level: "HIGH",
    score: 45,
    flightCategory: "IFR",
    factors: ["Instrument flight rules (low ceiling/visibility)"],
    raw: "14004KT 1800 BR OVC006",
    windDir: "140",
    windSpeed: 4,
    windGust: null,
    visibility: "1.1",
    wxString: "BR",
  },
  {
    level: "HIGH",
    score: 60,
    flightCategory: "IFR",
    factors: [
      "Instrument flight rules (low ceiling/visibility)",
      "Strong gusts to 28kt (sustained 14kt)",
    ],
    raw: "21014G28KT 2200 RA OVC008",
    windDir: "210",
    windSpeed: 14,
    windGust: 28,
    visibility: "1.4",
    wxString: "RA",
  },
  {
    level: "SEVERE",
    score: 95,
    flightCategory: "LIFR",
    factors: [
      "Low instrument flight rules (very low ceiling/visibility)",
      "Thunderstorms reported (TS)",
      "Severe gusts to 42kt (sustained 18kt)",
      "Heavy intensity precipitation (+)",
    ],
    raw: "18018G42KT 0400 +TSRA OVC003",
    windDir: "180",
    windSpeed: 18,
    windGust: 42,
    visibility: "0.25",
    wxString: "+TSRA",
  },
  {
    level: "SEVERE",
    score: 85,
    flightCategory: "LIFR",
    factors: [
      "Low instrument flight rules (very low ceiling/visibility)",
      "Fog reported — visibility risk (FG)",
    ],
    raw: "03003KT 0200 FG VV002",
    windDir: "30",
    windSpeed: 3,
    windGust: null,
    visibility: "0.12",
    wxString: "FG",
  },
];

const ESCALATED_SCENARIOS = SCENARIOS.filter((s) => s.level === "HIGH" || s.level === "SEVERE");

// Weighted so most airports look calm, matching real-world live observation
// (roughly 70% LOW / 20% MEDIUM / 8% HIGH / 2% SEVERE).
const WEIGHTS = [40, 18, 12, 12, 8, 6, 4];
const CUMULATIVE = WEIGHTS.reduce<number[]>((acc, w, i) => {
  acc.push((acc[i - 1] ?? 0) + w);
  return acc;
}, []);
const TOTAL = CUMULATIVE[CUMULATIVE.length - 1];

function pickScenario(icao: string): Scenario {
  const bucket = hash(icao) % TOTAL;
  const idx = CUMULATIVE.findIndex((c) => bucket < c);
  return SCENARIOS[idx];
}

export function pickEscalatedScenario(): Scenario {
  return ESCALATED_SCENARIOS[Math.floor(Math.random() * ESCALATED_SCENARIOS.length)];
}

export function applyScenario(airport: Airport, scenario: Scenario): AirportWithStatus {
  const now = new Date().toISOString();
  return {
    ...airport,
    weather: {
      icao: airport.icao,
      fetched_at: now,
      obs_time: now,
      raw_metar: `METAR ${airport.icao} ${scenario.raw} Q1013 NOSIG`,
      flight_category: scenario.flightCategory,
      wind_dir: scenario.windDir,
      wind_speed_kt: scenario.windSpeed,
      wind_gust_kt: scenario.windGust,
      visibility_sm: scenario.visibility,
      weather_string: scenario.wxString,
      clouds: [],
      is_stale: false,
    },
    risk: {
      icao: airport.icao,
      score: scenario.score,
      level: scenario.level,
      factors: scenario.factors,
      updated_at: now,
    },
  };
}

export function buildMockAirports(): AirportWithStatus[] {
  return AIRPORTS.map((airport) => applyScenario(airport, pickScenario(airport.icao)));
}

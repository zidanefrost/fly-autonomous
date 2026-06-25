export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "SEVERE";

export interface Airport {
  icao: string;
  iata: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
}

export interface WeatherObservation {
  icao: string;
  fetched_at: string;
  obs_time: string | null;
  raw_metar: string | null;
  flight_category: string | null;
  wind_dir: string | null;
  wind_speed_kt: number | null;
  wind_gust_kt: number | null;
  visibility_sm: string | null;
  weather_string: string | null;
  clouds: { cover: string; base: number }[] | null;
  is_stale: boolean;
}

export interface DelayRisk {
  icao: string;
  score: number;
  level: RiskLevel;
  factors: string[];
  updated_at: string;
}

export interface AirportWithStatus extends Airport {
  weather: WeatherObservation | null;
  risk: DelayRisk | null;
}

export const RISK_COLORS: Record<RiskLevel, string> = {
  LOW: "#34d399",
  MEDIUM: "#fbbf24",
  HIGH: "#fb923c",
  SEVERE: "#f87171",
};

import { useState } from "react";
import { Map, Marker, NavigationControl, Popup } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { AirportWithStatus } from "../lib/types";
import { RISK_COLORS } from "../lib/types";

const CARTO_DARK_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const PULSE_LEVELS = new Set(["HIGH", "SEVERE"]);

export function MapView({
  airports,
  selectedIcao,
  onSelect,
}: {
  airports: AirportWithStatus[];
  selectedIcao: string | null;
  onSelect: (icao: string) => void;
}) {
  const [hoveredIcao, setHoveredIcao] = useState<string | null>(null);
  const hovered = airports.find((a) => a.icao === hoveredIcao) ?? null;

  return (
    <Map
      initialViewState={{ longitude: 30, latitude: 20, zoom: 1.6 }}
      mapStyle={CARTO_DARK_STYLE}
      style={{ width: "100%", height: "100%" }}
      attributionControl={{ compact: true }}
    >
      <NavigationControl position="top-right" showCompass={false} />

      {airports.map((airport) => {
        const level = airport.risk?.level ?? "LOW";
        const color = RISK_COLORS[level];
        const isSelected = airport.icao === selectedIcao;
        const pulse = PULSE_LEVELS.has(level);
        return (
          <Marker
            key={airport.icao}
            longitude={airport.lon}
            latitude={airport.lat}
            anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              onSelect(airport.icao);
            }}
          >
            <button
              type="button"
              onMouseEnter={() => setHoveredIcao(airport.icao)}
              onMouseLeave={() => setHoveredIcao(null)}
              className={`block rounded-full border-2 border-white/70 transition-transform hover:scale-150 ${
                pulse ? "risk-pulse" : ""
              }`}
              style={{
                width: isSelected ? 14 : 9,
                height: isSelected ? 14 : 9,
                backgroundColor: color,
                cursor: "pointer",
              }}
              aria-label={`${airport.icao} ${level} risk`}
            />
          </Marker>
        );
      })}

      {hovered && (
        <Popup
          longitude={hovered.lon}
          latitude={hovered.lat}
          closeButton={false}
          closeOnClick={false}
          anchor="bottom"
          offset={12}
        >
          <div className="text-xs">
            <div className="font-semibold">
              {hovered.icao} · {hovered.iata}
            </div>
            <div className="text-slate-400">
              {hovered.name}, {hovered.city}
            </div>
            <div className="mt-1" style={{ color: RISK_COLORS[hovered.risk?.level ?? "LOW"] }}>
              {hovered.risk?.level ?? "LOW"} risk ({hovered.risk?.score ?? 0})
            </div>
          </div>
        </Popup>
      )}
    </Map>
  );
}

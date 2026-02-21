"use client";

import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ── Hardcoded demo coordinates (downtown grid) ─────────────────────────
// Using a generic city layout — swap with your real intersection coords.
const INTERSECTION_COORDS: [number, number][] = [
  [12.9716, 77.5946], // INT-1  (Bangalore MG Road area)
  [12.9750, 77.5990], // INT-2
  [12.9780, 77.6040], // INT-3
  [12.9810, 77.6090], // INT-4
];

// Ambulance starts south-west of INT-1 and heads toward the corridor
const AMBULANCE_START: [number, number] = [12.9680, 77.5900];

// Route: ambulance → INT-1 → INT-2 → INT-3 → INT-4
const ROUTE_COORDS: [number, number][] = [
  AMBULANCE_START,
  ...INTERSECTION_COORDS,
];

// ── Custom marker icons ────────────────────────────────────────────────
const intersectionIcon = (active: boolean) =>
  L.divIcon({
    className: "",
    html: `<div style="
      width:18px;height:18px;border-radius:50%;
      background:${active ? "#00e676" : "#f44336"};
      border:2px solid #fff;
      box-shadow:0 0 ${active ? "12px 4px rgba(0,230,118,0.6)" : "8px 2px rgba(244,67,54,0.4)"};
      transition:all .4s ease;
    "></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

const ambulanceIcon = L.divIcon({
  className: "",
  html: `
    <div style="position:relative;width:28px;height:28px;">
      <div style="
        position:absolute;inset:0;border-radius:50%;
        background:rgba(244,67,54,0.35);
        animation:ambPulse 1.2s ease-in-out infinite;
      "></div>
      <div style="
        position:absolute;inset:4px;border-radius:50%;
        background:#f44336;border:2px solid #fff;
        display:flex;align-items:center;justify-content:center;
        font-size:14px;line-height:1;
      ">🚑</div>
    </div>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

// ── Fit bounds helper ──────────────────────────────────────────────────
function FitBounds() {
  const map = useMap();
  useEffect(() => {
    const bounds = L.latLngBounds(ROUTE_COORDS.map(([lat, lng]) => [lat, lng]));
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map]);
  return null;
}

// ── Props ──────────────────────────────────────────────────────────────
interface LiveMapProps {
  /** true while a detection is active (INT-1 green window) */
  active: boolean;
}

// ── Component ──────────────────────────────────────────────────────────
export default function LiveMap({ active }: LiveMapProps) {
  return (
    <>
      {/* Inject the pulse keyframe once */}
      <style>{`
        @keyframes ambPulse {
          0%   { transform:scale(1);   opacity:0.7; }
          50%  { transform:scale(1.8); opacity:0; }
          100% { transform:scale(1);   opacity:0; }
        }
      `}</style>

      <MapContainer
        center={[12.9745, 77.5995]}
        zoom={15}
        scrollWheelZoom={true}
        style={{ width: "100%", height: "100%", borderRadius: 12 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        <FitBounds />

        {/* Intersection markers */}
        {INTERSECTION_COORDS.map(([lat, lng], idx) => (
          <Marker
            key={idx}
            position={[lat, lng]}
            icon={intersectionIcon(idx === 0 && active)}
          >
            <Popup>
              <strong>INT-{idx + 1}</strong>
              <br />
              {idx === 0 && active ? "🟢 GREEN — corridor active" : "🔴 RED"}
            </Popup>
          </Marker>
        ))}

        {/* Ambulance marker + route — shown when detection is active */}
        {active && (
          <>
            <Marker position={AMBULANCE_START} icon={ambulanceIcon}>
              <Popup>🚑 Ambulance detected</Popup>
            </Marker>
            <Polyline
              positions={ROUTE_COORDS}
              pathOptions={{
                color: "#00e676",
                weight: 4,
                opacity: 0.85,
                dashArray: "10 6",
              }}
            />
          </>
        )}
      </MapContainer>
    </>
  );
}

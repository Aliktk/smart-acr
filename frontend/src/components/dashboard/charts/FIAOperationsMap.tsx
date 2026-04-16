"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";

interface HeatPoint {
  lat: number;
  lng: number;
  intensity: number; // 0–1
  city: string;
  overdue?: number;
  total?: number;
}

interface FIAOperationsMapProps {
  heatPoints?: HeatPoint[];
  title?: string;
  height?: number;
}

// Pakistan FIA station cities — varied intensities for a striking heatmap
const PAKISTAN_STATIONS: HeatPoint[] = [
  { lat: 24.8607, lng: 67.0011, intensity: 0.95, city: "Karachi",    overdue: 18, total: 42 },
  { lat: 31.5204, lng: 74.3587, intensity: 0.68, city: "Lahore",     overdue: 9,  total: 38 },
  { lat: 33.6844, lng: 73.0479, intensity: 0.48, city: "Islamabad",  overdue: 5,  total: 31 },
  { lat: 34.0151, lng: 71.5249, intensity: 0.58, city: "Peshawar",   overdue: 7,  total: 22 },
  { lat: 30.1798, lng: 66.9750, intensity: 0.88, city: "Quetta",     overdue: 14, total: 28 },
  { lat: 30.1575, lng: 71.5249, intensity: 0.62, city: "Multan",     overdue: 8,  total: 24 },
  { lat: 31.4504, lng: 73.1350, intensity: 0.40, city: "Faisalabad", overdue: 4,  total: 27 },
  { lat: 25.3960, lng: 68.3578, intensity: 0.75, city: "Hyderabad",  overdue: 11, total: 19 },
  { lat: 33.5651, lng: 73.0169, intensity: 0.32, city: "Rawalpindi", overdue: 3,  total: 20 },
  { lat: 32.1877, lng: 74.1945, intensity: 0.44, city: "Gujranwala", overdue: 5,  total: 18 },
  { lat: 32.4945, lng: 74.5229, intensity: 0.36, city: "Sialkot",    overdue: 4,  total: 15 },
  { lat: 34.1463, lng: 73.2117, intensity: 0.22, city: "Abbottabad", overdue: 2,  total: 12 },
  { lat: 27.7052, lng: 68.8574, intensity: 0.70, city: "Sukkur",     overdue: 9,  total: 16 },
  { lat: 27.5570, lng: 68.2140, intensity: 0.52, city: "Larkana",    overdue: 6,  total: 14 },
];

function getIntensityColor(intensity: number): string {
  if (intensity >= 0.8) return "#EF4444"; // red
  if (intensity >= 0.6) return "#F97316"; // orange
  if (intensity >= 0.4) return "#EAB308"; // yellow
  if (intensity >= 0.25) return "#22C55E"; // green
  return "#06B6D4"; // teal
}

export function FIAOperationsMap({
  heatPoints,
  title,
  height = 380,
}: FIAOperationsMapProps) {
  const mapRef     = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<LeafletMap | null>(null);

  const stations = heatPoints && heatPoints.length > 0 ? heatPoints : PAKISTAN_STATIONS;

  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current) return;
    if (leafletRef.current) return; // already initialised

    let map: LeafletMap | null = null;

    (async () => {
      const leafletModule  = await import("leaflet");
      const L              = leafletModule.default ?? leafletModule;
      // leaflet.heat attaches itself to the L global — import side-effects only
      await import("leaflet.heat" as string);

      if (!mapRef.current) return;

      // Fix Leaflet icon paths in Next.js
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl:       "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl:     "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      map = L.map(mapRef.current, {
        center: [30.0, 69.5],
        zoom: 5,
        zoomControl: true,
        attributionControl: false,
        scrollWheelZoom: true,
        minZoom: 4,
        maxZoom: 10,
      });

      leafletRef.current = map;

      // CartoDB Voyager — modern light tiles with land/water distinction
      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        subdomains: "abcd",
        maxZoom: 10,
      }).addTo(map);

      // ── Heatmap layer via leaflet.heat ──────────────────────────────────
      // Each point: [lat, lng, intensity]
      const heatData = stations.map((s) => [s.lat, s.lng, s.intensity] as [number, number, number]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const heatLayer = (L as any).heatLayer(heatData, {
        radius:  42,
        blur:    32,
        maxZoom: 8,
        max:     1.0,
        gradient: {
          0.00: "rgba(56,189,248,0)",    // transparent — no data
          0.20: "rgba(56,189,248,0.7)",  // sky-blue — very low
          0.40: "rgba(34,197,94,0.85)",  // green — low-medium
          0.60: "rgba(250,204,21,0.9)",  // yellow — medium-high
          0.80: "rgba(249,115,22,0.95)", // orange — high
          1.00: "rgba(239,68,68,1)",     // red — critical
        },
      });
      heatLayer.addTo(map);

      // ── City label markers with intensity dots ─────────────────────────
      stations.forEach((station) => {
        const dotColor = getIntensityColor(station.intensity);
        const dotSize  = Math.round(8 + station.intensity * 10);

        const icon = L.divIcon({
          className: "",
          iconSize: [dotSize, dotSize],
          iconAnchor: [dotSize / 2, dotSize / 2],
          html: `<div style="
            width:${dotSize}px;height:${dotSize}px;border-radius:50%;
            background:${dotColor};
            border:2.5px solid #ffffff;
            box-shadow:0 0 ${dotSize * 2}px ${dotColor}90, 0 2px 6px rgba(0,0,0,0.18);
          "></div>`,
        });

        const popupHtml = `
          <div style="font-family:inherit;font-size:12px;min-width:155px;padding:2px 0;color:#0F172A">
            <b style="font-size:13px">${station.city}</b>
            <div style="margin-top:4px;display:flex;align-items:center;gap:6px">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${dotColor}"></span>
              <span style="color:#475569;font-size:11px">Intensity: <b style="color:#0F172A">${Math.round(station.intensity * 100)}%</b></span>
            </div>
            ${station.total   != null ? `<div style="color:#475569;font-size:11px;margin-top:2px">Total ACRs: <b style="color:#0F172A">${station.total}</b></div>` : ""}
            ${station.overdue != null ? `<div style="color:#DC2626;font-size:11px;margin-top:2px">⚠ Overdue: <b>${station.overdue}</b></div>` : ""}
          </div>
        `;

        L.marker([station.lat, station.lng], { icon })
          .bindPopup(popupHtml, {
            className: "fia-map-popup",
            offset: [0, -dotSize / 2],
          })
          .addTo(map!);
      });

      // Popup styling
      const style = document.createElement("style");
      style.textContent = `
        .fia-map-popup .leaflet-popup-content-wrapper {
          border-radius: 14px;
          box-shadow: 0 6px 24px rgba(0,0,0,0.18);
          border: 1px solid #e2e8f0;
          background: #ffffff;
        }
        .fia-map-popup .leaflet-popup-content { margin: 10px 14px; }
        .fia-map-popup .leaflet-popup-tip-container { display: none; }
      `;
      document.head.appendChild(style);
    })().catch(console.error);

    return () => {
      if (leafletRef.current) {
        leafletRef.current.remove();
        leafletRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--fia-gray-200)] bg-[var(--card)] shadow-sm">
      {title ? (
        <div className="flex items-center justify-between border-b border-[var(--fia-gray-100)] px-4 py-3">
          <h3 className="text-sm font-bold text-[var(--fia-gray-900)]">{title}</h3>
          {/* Intensity scale */}
          <div className="flex items-center gap-3 text-[10px] text-[var(--fia-gray-500)]">
            {[
              { label: "Low",      color: "#38BDF8" },
              { label: "Medium",   color: "#22C55E" },
              { label: "High",     color: "#FACC15" },
              { label: "Critical", color: "#EF4444" },
            ].map((item) => (
              <span key={item.label} className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                {item.label}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      <div ref={mapRef} style={{ height, width: "100%" }} className="z-0" />
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";

export interface StopPin {
  id: string;
  stopName: string;
  latitude: number;
  longitude: number;
  status: string;
  votes: number;
  routeHeading: string;
}

const STATUS_COLOR: Record<string, string> = {
  PENDING:  "#f59e0b",
  VERIFIED: "#2d9e5c",
  FLAGGED:  "#f87171",
};

export default function AdminMap({ stops }: { stops: StopPin[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Inject Leaflet CSS from CDN (avoids Next.js CSS bundling issues)
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id   = "leaflet-css";
      link.rel  = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    import("leaflet").then((L) => {
      if (!containerRef.current || mapRef.current) return;

      const center: [number, number] =
        stops.length > 0 ? [stops[0].latitude, stops[0].longitude] : [5.6037, -0.187];

      const map = L.map(containerRef.current, {
        center,
        zoom: 12,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
      }).addTo(map);

      stops.forEach((stop) => {
        const color = STATUS_COLOR[stop.status] ?? "#2d9e5c";
        const icon  = L.divIcon({
          html: `<div style="width:14px;height:14px;background:${color};border-radius:50%;border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,.45)"></div>`,
          iconSize:   [14, 14],
          iconAnchor: [7, 7],
          className:  "",
        });
        const routes = stop.routeHeading !== "Not specified"
          ? `<br/><span style="color:#888;font-size:11px">${stop.routeHeading.slice(0, 70)}</span>`
          : "";
        L.marker([stop.latitude, stop.longitude], { icon })
          .addTo(map)
          .bindPopup(
            `<div style="font-family:system-ui,sans-serif;font-size:12px;line-height:1.5">
              <b style="color:var(--bg-raised)">${stop.stopName}</b>
              <br/><span style="color:#666">${stop.status} · ${stop.votes} vote${stop.votes !== 1 ? "s" : ""}</span>
              ${routes}
            </div>`,
            { maxWidth: 220 }
          );
      });

      if (stops.length > 1) {
        const bounds = L.latLngBounds(stops.map((s) => [s.latitude, s.longitude] as [number, number]));
        map.fitBounds(bounds, { padding: [32, 32] });
      }

      mapRef.current = map;
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  // only run once on mount — stops are stable at this point
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className="w-full h-full" />;
}

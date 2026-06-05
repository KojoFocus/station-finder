"use client";

import { useEffect, useRef } from "react";

export interface RouteMapProps {
  userLocation: { lat: number; lng: number } | null;
  boardingStop: { name: string; lat: number; lng: number } | null;
  destCoords: { lat: number; lng: number } | null;
  walkingGeoJSON: object | null;
  followUser?: boolean; // pan map to user position when true
}

const DEFAULT_CENTER: [number, number] = [5.69, -0.15];

export default function RouteMap({
  userLocation,
  boardingStop,
  destCoords,
  walkingGeoJSON,
  followUser = false,
}: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<import("leaflet").Map | null>(null);
  const userMarkerRef   = useRef<import("leaflet").Layer | null>(null);
  const routeLayersRef  = useRef<import("leaflet").Layer[]>([]);
  const initializedRef  = useRef(false);

  // ── Boot Leaflet once ──────────────────────────────────────────────────────
  useEffect(() => {
    if (initializedRef.current || !containerRef.current) return;
    initializedRef.current = true;

    // Guard against React Strict Mode's double-invoke: the async import
    // can resolve after cleanup has already run, so we check `aborted`.
    let aborted = false;

    import("leaflet").then((mod) => {
      if (aborted || !containerRef.current) return;
      // Leaflet caches immediately — if Strict Mode already ran this and
      // the container still has a _leaflet_id, skip to avoid double-init.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((containerRef.current as any)._leaflet_id) return;
      const L = mod.default ?? mod;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      mapRef.current = L.map(containerRef.current!, {
        center: DEFAULT_CENTER,
        zoom: 14,
        zoomControl: false,
        attributionControl: false, // we add a styled one below
      });

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_matter/{z}/{x}/{y}{r}.png",
        { maxZoom: 19, subdomains: "abcd" }
      ).addTo(mapRef.current);

      // Minimal attribution (CartoDB requires it)
      L.control.attribution({ position: "bottomright", prefix: false })
        .addAttribution('© <a href="https://carto.com" style="color:#4a7c59">CARTO</a>')
        .addTo(mapRef.current);
    });

    return () => {
      aborted = true;
      mapRef.current?.remove();
      mapRef.current = null;
      initializedRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Update user position dot (runs on every GPS update) ───────────────────
  useEffect(() => {
    if (!userLocation) return;

    const run = () => {
      if (!mapRef.current) return;
      import("leaflet").then((mod) => {
        const L = mod.default ?? mod;

        if (userMarkerRef.current) {
          mapRef.current!.removeLayer(userMarkerRef.current);
        }

        const icon = L.divIcon({
          className: "",
          html: `
            <div style="position:relative;width:22px;height:22px">
              <div style="position:absolute;inset:0;border-radius:50%;background:#4a7c59;opacity:.35;animation:sfping 1.8s ease-out infinite"></div>
              <div style="position:absolute;top:4px;left:4px;width:14px;height:14px;border-radius:50%;background:#4a7c59;border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,.5)"></div>
            </div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });

        userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], {
          icon,
          zIndexOffset: 1000,
        })
          .addTo(mapRef.current!)
          .bindPopup("You are here");

        if (followUser) {
          mapRef.current!.panTo([userLocation.lat, userLocation.lng], {
            animate: true,
            duration: 0.6,
          });
        }
      });
    };

    // If map isn't ready yet, retry after 800 ms
    if (!mapRef.current) { setTimeout(run, 800); } else { run(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation?.lat, userLocation?.lng, followUser]);

  // ── Draw route layers (walking path + stop markers) ───────────────────────
  useEffect(() => {
    const run = () => {
      if (!mapRef.current) return;
      import("leaflet").then((mod) => {
        const L = mod.default ?? mod;

        // Clear previous route layers
        routeLayersRef.current.forEach((l) => mapRef.current?.removeLayer(l));
        routeLayersRef.current = [];

        const bounds: [number, number][] = [];

        // Walking route polyline
        if (walkingGeoJSON) {
          const line = L.geoJSON(walkingGeoJSON as Parameters<typeof L.geoJSON>[0], {
            style: { color: "#4a7c59", weight: 5, opacity: 0.9, dashArray: "10 7", lineCap: "round" },
          }).addTo(mapRef.current!);
          routeLayersRef.current.push(line);
        }

        // Boarding stop marker
        if (boardingStop) {
          const icon = L.divIcon({
            className: "",
            html: `
              <div style="
                background:#4a7c59;color:white;
                width:36px;height:36px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);
                border:2.5px solid white;box-shadow:0 3px 10px rgba(0,0,0,.4);
                display:flex;align-items:center;justify-content:center;font-size:16px
              ">
                <span style="transform:rotate(45deg)">🚐</span>
              </div>`,
            iconSize: [36, 36],
            iconAnchor: [12, 36],
          });
          const m = L.marker([boardingStop.lat, boardingStop.lng], { icon })
            .addTo(mapRef.current!)
            .bindPopup(`<b>${boardingStop.name}</b><br>Board here`);
          routeLayersRef.current.push(m);
          bounds.push([boardingStop.lat, boardingStop.lng]);
        }

        // Destination marker
        if (destCoords) {
          const icon = L.divIcon({
            className: "",
            html: `
              <div style="
                background:#f0c040;color:#1a1200;
                width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);
                border:2px solid white;box-shadow:0 3px 10px rgba(0,0,0,.4);
                display:flex;align-items:center;justify-content:center;font-size:14px
              ">
                <span style="transform:rotate(45deg)">📍</span>
              </div>`,
            iconSize: [30, 30],
            iconAnchor: [9, 30],
          });
          const m = L.marker([destCoords.lat, destCoords.lng], { icon })
            .addTo(mapRef.current!)
            .bindPopup("Your destination");
          routeLayersRef.current.push(m);
          bounds.push([destCoords.lat, destCoords.lng]);
        }

        if (userLocation) bounds.push([userLocation.lat, userLocation.lng]);

        if (bounds.length > 1) {
          mapRef.current!.fitBounds(bounds, { padding: [52, 52], maxZoom: 16 });
        } else if (bounds.length === 1) {
          mapRef.current!.setView(bounds[0], 15);
        }
      });
    };

    if (!mapRef.current) { setTimeout(run, 800); } else { run(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardingStop?.lat, boardingStop?.lng, destCoords?.lat, destCoords?.lng, walkingGeoJSON]);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-[#1e2e1c]">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <style>{`@keyframes sfping{0%{transform:scale(1);opacity:.35}70%{transform:scale(2.5);opacity:0}100%{transform:scale(1);opacity:0}}`}</style>
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}

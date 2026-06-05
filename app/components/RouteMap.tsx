"use client";

import { useEffect, useRef } from "react";

export interface RouteMapProps {
  userLocation: { lat: number; lng: number } | null;
  boardingStop: { name: string; lat: number; lng: number } | null;
  destCoords:   { lat: number; lng: number } | null;
  walkingGeoJSON: object | null;
  followUser?: boolean;
}

const TOKEN    = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
const DEFAULT: [number, number] = [-0.15, 5.69]; // Accra [lng, lat]

// Animated dashed-line offset for the walking route
let dashOffset = 0;

export default function RouteMap({
  userLocation, boardingStop, destCoords, walkingGeoJSON, followUser = false,
}: RouteMapProps) {
  const containerRef   = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef         = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef     = useRef<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userMarkerRef  = useRef<any>(null);
  const animFrameRef   = useRef<number | null>(null);
  const initializedRef = useRef(false);
  const mapReadyRef    = useRef(false);

  // ── Init map ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (initializedRef.current || !containerRef.current || !TOKEN) return;
    initializedRef.current = true;
    let aborted = false;

    import("mapbox-gl").then((mod) => {
      if (aborted || !containerRef.current) return;
      const mapboxgl = mod.default;
      mapboxgl.accessToken = TOKEN;

      const map = new mapboxgl.Map({
        container: containerRef.current!,
        style:     "mapbox://styles/mapbox/navigation-night-v1",
        center:    DEFAULT,
        zoom:      13,
        attributionControl: false,
        pitchWithRotate: false,
      });

      map.addControl(
        new mapboxgl.AttributionControl({ compact: true }),
        "bottom-right"
      );

      map.on("load", () => {
        mapReadyRef.current = true;

        // Walking route source + layers (dashed green line)
        map.addSource("walking", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({
          id: "walking-bg",
          type: "line", source: "walking",
          paint: { "line-color": "#4a7c59", "line-width": 5, "line-opacity": 0.25 },
        });
        map.addLayer({
          id: "walking-dash",
          type: "line", source: "walking",
          paint: {
            "line-color": "#4a7c59", "line-width": 5,
            "line-dasharray": [0, 4, 3], "line-opacity": 0.95,
          },
        });

        // Animate the dash offset for a "marching ants" walking effect
        const animateDash = () => {
          dashOffset = (dashOffset - 0.5) % 512;
          if (map.getLayer("walking-dash")) {
            map.setPaintProperty("walking-dash", "line-dasharray", [0, 4, 3]);
            map.setPaintProperty("walking-dash", "line-offset", dashOffset * 0.04);
          }
          animFrameRef.current = requestAnimationFrame(animateDash);
        };
        animateDash();
      });

      mapRef.current = map;
    });

    return () => {
      aborted = true;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      markersRef.current.forEach((m) => m.remove());
      userMarkerRef.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
      mapReadyRef.current = false;
      initializedRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── User location dot ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!userLocation) return;
    const run = () => {
      if (!mapRef.current) return;
      import("mapbox-gl").then((mod) => {
        const mapboxgl = mod.default;
        userMarkerRef.current?.remove();

        const el = document.createElement("div");
        el.style.cssText = `
          position:relative;width:22px;height:22px;
        `;
        el.innerHTML = `
          <div style="position:absolute;inset:0;border-radius:50%;background:#4a7c59;opacity:.3;animation:sfping 1.8s ease-out infinite"></div>
          <div style="position:absolute;top:4px;left:4px;width:14px;height:14px;border-radius:50%;background:#4a7c59;border:2.5px solid white;box-shadow:0 2px 8px rgba(0,0,0,.6)"></div>
        `;
        userMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([userLocation.lng, userLocation.lat])
          .addTo(mapRef.current);

        if (followUser) {
          mapRef.current.easeTo({ center: [userLocation.lng, userLocation.lat], duration: 600 });
        }
      });
    };
    if (!mapRef.current) setTimeout(run, 1000); else run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation?.lat, userLocation?.lng, followUser]);

  // ── Route markers + walking path ────────────────────────────────────────────
  useEffect(() => {
    const run = () => {
      if (!mapRef.current || !mapReadyRef.current) return;
      import("mapbox-gl").then((mod) => {
        const mapboxgl = mod.default;

        // Clear old route markers
        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];

        const bounds: [[number, number], [number, number]] = [
          [999, 999], [-999, -999],
        ];
        const expand = (lng: number, lat: number) => {
          bounds[0][0] = Math.min(bounds[0][0], lng);
          bounds[0][1] = Math.min(bounds[0][1], lat);
          bounds[1][0] = Math.max(bounds[1][0], lng);
          bounds[1][1] = Math.max(bounds[1][1], lat);
        };

        // Update walking GeoJSON
        const src = mapRef.current.getSource("walking");
        if (src) {
          src.setData(
            walkingGeoJSON
              ? (walkingGeoJSON as object)
              : { type: "FeatureCollection", features: [] }
          );
        }

        // Boarding stop marker
        if (boardingStop) {
          const el = document.createElement("div");
          el.innerHTML = `
            <div style="
              background:#4a7c59;color:white;
              width:40px;height:40px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);
              border:2.5px solid white;box-shadow:0 4px 14px rgba(0,0,0,.5);
              display:flex;align-items:center;justify-content:center;font-size:18px;
              cursor:pointer;transition:transform .15s;
            ">
              <span style="transform:rotate(45deg)">🚐</span>
            </div>`;
          const m = new mapboxgl.Marker({ element: el, anchor: "bottom-left" })
            .setLngLat([boardingStop.lng, boardingStop.lat])
            .setPopup(new mapboxgl.Popup({ offset: 30 }).setHTML(`<b>${boardingStop.name}</b><br>Board here`))
            .addTo(mapRef.current);
          markersRef.current.push(m);
          expand(boardingStop.lng, boardingStop.lat);
        }

        // Destination marker
        if (destCoords) {
          const el = document.createElement("div");
          el.innerHTML = `
            <div style="
              background:#f0c040;color:#1a1200;
              width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);
              border:2px solid white;box-shadow:0 4px 14px rgba(0,0,0,.5);
              display:flex;align-items:center;justify-content:center;font-size:16px;
            ">
              <span style="transform:rotate(45deg)">📍</span>
            </div>`;
          const m = new mapboxgl.Marker({ element: el, anchor: "bottom-left" })
            .setLngLat([destCoords.lng, destCoords.lat])
            .setPopup(new mapboxgl.Popup({ offset: 28 }).setText("Your destination"))
            .addTo(mapRef.current);
          markersRef.current.push(m);
          expand(destCoords.lng, destCoords.lat);
        }

        if (userLocation) expand(userLocation.lng, userLocation.lat);

        // Fit bounds smoothly
        const hasBounds = bounds[0][0] !== 999;
        if (hasBounds) {
          if (boardingStop && destCoords) {
            mapRef.current.fitBounds(bounds, { padding: 72, maxZoom: 15, duration: 900 });
          } else {
            mapRef.current.flyTo({ center: [bounds[0][0], bounds[0][1]], zoom: 15, duration: 900 });
          }
        }
      });
    };

    if (!mapReadyRef.current) setTimeout(run, 1200); else run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardingStop?.lat, boardingStop?.lng, destCoords?.lat, destCoords?.lng, walkingGeoJSON]);

  // ── Render ───────────────────────────────────────────────────────────────────
  if (!TOKEN) {
    return (
      <div className="relative w-full h-full rounded-2xl overflow-hidden border border-[#1e2e1c] bg-surface-card flex items-center justify-center flex-col gap-2">
        <span className="text-2xl">🗺️</span>
        <p className="text-content-muted text-xs text-center px-4">Add <code className="text-accent">NEXT_PUBLIC_MAPBOX_TOKEN</code> to enable the map</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-[#1e2e1c]">
      <style>{`
        @keyframes sfping { 0%{transform:scale(1);opacity:.3} 70%{transform:scale(2.8);opacity:0} 100%{transform:scale(1);opacity:0} }
        .mapboxgl-ctrl-attrib { background: rgba(13,26,11,.7) !important; border-radius: 6px !important; }
        .mapboxgl-ctrl-attrib a { color: #4a7c59 !important; }
        .mapboxgl-ctrl-attrib-button { display: none !important; }
        .mapboxgl-popup-content { background: #1a2e18; color: #d4e8cc; border: 1px solid #2e4a2a; border-radius: 10px; padding: 8px 12px; font-size: 12px; box-shadow: 0 4px 20px rgba(0,0,0,.6); }
        .mapboxgl-popup-tip { border-top-color: #1a2e18 !important; border-bottom-color: #1a2e18 !important; }
      `}</style>
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}

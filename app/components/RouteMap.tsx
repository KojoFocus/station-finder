"use client";

import { useEffect, useRef } from "react";

export interface RouteMapProps {
  userLocation: { lat: number; lng: number } | null;
  boardingStop: { name: string; lat: number; lng: number } | null;
  destCoords:   { lat: number; lng: number } | null;
  walkingGeoJSON: object | null;
  followUser?: boolean;
}

const TOKEN   = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
const DEFAULT: [number, number] = [-0.15, 5.69]; // Accra [lng, lat]

function calcBearing(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos((b.lat * Math.PI) / 180);
  const x =
    Math.cos((a.lat * Math.PI) / 180) * Math.sin((b.lat * Math.PI) / 180) -
    Math.sin((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export default function RouteMap({
  userLocation, boardingStop, destCoords, walkingGeoJSON, followUser = false,
}: RouteMapProps) {
  const containerRef   = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef         = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userMarkerRef  = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routeMarkersRef = useRef<any[]>([]);
  const animFrameRef   = useRef<number | null>(null);
  const dashOffsetRef  = useRef(0);
  const initializedRef = useRef(false);
  const mapReadyRef    = useRef(false);
  const prevLocRef     = useRef<{ lat: number; lng: number } | null>(null);
  const bearingRef     = useRef(0);
  const hasRouteRef    = useRef(false);

  // ── Init ─────────────────────────────────────────────────────────────────────
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
        pitch:     0,
        bearing:   0,
        attributionControl: false,
      });

      map.addControl(
        new mapboxgl.AttributionControl({ compact: true }),
        "bottom-right"
      );

      map.on("load", () => {
        mapReadyRef.current = true;

        // ── Trotro stops layer ──────────────────────────────────────────────
        map.addSource("stops", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "stops-halo", type: "circle", source: "stops",
          paint: {
            "circle-radius": 11,
            "circle-color": "#4a7c59",
            "circle-opacity": 0.18,
            "circle-blur": 1,
          },
        });
        map.addLayer({
          id: "stops-dot", type: "circle", source: "stops",
          paint: {
            "circle-radius": 5,
            "circle-color": "#6aff9a",
            "circle-stroke-width": 1.5,
            "circle-stroke-color": "#ffffff",
            "circle-opacity": 0.85,
          },
        });

        // Tap a stop — show its name + routes
        map.on("click", "stops-dot", (e: any) => {
          if (!e.features?.length) return;
          const f = e.features[0];
          const { stopName, routeHeading } = f.properties;
          new mapboxgl.Popup({ offset: 12 })
            .setLngLat(e.lngLat)
            .setHTML(`<b>${stopName}</b>${routeHeading && routeHeading !== "Not specified" ? `<br><span style="opacity:.7;font-size:11px">${routeHeading}</span>` : ""}`)
            .addTo(map);
        });
        map.on("mouseenter", "stops-dot", () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", "stops-dot", () => { map.getCanvas().style.cursor = ""; });

        // Load stops from API
        fetch("/api/stops")
          .then((r) => r.json())
          .then((gj) => { if (map.getSource("stops")) (map.getSource("stops") as any).setData(gj); })
          .catch(() => {});

        // ── Walking route layers (glow stack) ───────────────────────────────
        map.addSource("walking", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });

        // Outer glow
        map.addLayer({
          id: "walking-glow-outer", type: "line", source: "walking",
          paint: { "line-color": "#4a7c59", "line-width": 18, "line-opacity": 0.10, "line-blur": 12 },
        });
        // Mid glow
        map.addLayer({
          id: "walking-glow-mid", type: "line", source: "walking",
          paint: { "line-color": "#4a7c59", "line-width": 10, "line-opacity": 0.22, "line-blur": 5 },
        });
        // Core bright line
        map.addLayer({
          id: "walking-core", type: "line", source: "walking",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#6aff9a", "line-width": 4, "line-opacity": 0.95 },
        });
        // Animated white dashes on top
        map.addLayer({
          id: "walking-dash", type: "line", source: "walking",
          layout: { "line-cap": "butt" },
          paint: {
            "line-color": "#ffffff",
            "line-width": 3,
            "line-dasharray": [0, 4, 3],
            "line-opacity": 0.55,
          },
        });

        // Animate dashes
        const animateDash = () => {
          dashOffsetRef.current -= 0.45;
          const t = dashOffsetRef.current;
          const step = (((-t) % 7) + 7) % 7;
          if (map.getLayer("walking-dash")) {
            try {
              const phase = step / 7;
              map.setPaintProperty("walking-dash", "line-dasharray",
                phase < 0.43 ? [phase * 7, 4 - phase * 7 * 0.6, 3] : [0, 4, 3]
              );
            } catch { /* layer not ready */ }
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
      routeMarkersRef.current.forEach((m) => m.remove());
      userMarkerRef.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
      mapReadyRef.current = false;
      initializedRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── User location + smooth follow with heading ────────────────────────────
  useEffect(() => {
    if (!userLocation) return;
    const run = () => {
      if (!mapRef.current) return;
      import("mapbox-gl").then((mod) => {
        const mapboxgl = mod.default;

        // Update bearing from movement
        if (prevLocRef.current) {
          const dist = Math.hypot(
            userLocation.lat - prevLocRef.current.lat,
            userLocation.lng - prevLocRef.current.lng
          );
          if (dist > 0.00005) {
            const raw = calcBearing(prevLocRef.current, userLocation);
            // Smooth exponential average
            bearingRef.current = bearingRef.current * 0.7 + raw * 0.3;
          }
        }
        prevLocRef.current = userLocation;

        // Navigation puck: accuracy ring + direction cone + centre dot
        userMarkerRef.current?.remove();
        const bearing = bearingRef.current;
        const el = document.createElement("div");
        el.style.cssText = "position:relative;width:56px;height:56px;";
        el.innerHTML = `
          <svg width="56" height="56" viewBox="0 0 56 56" style="position:absolute;inset:0;overflow:visible">
            <!-- Accuracy ring (pulses) -->
            <circle cx="28" cy="28" r="26"
              fill="rgba(74,124,89,0.10)"
              stroke="rgba(106,255,154,0.25)"
              stroke-width="1"
              style="animation:sfping 2s ease-out infinite"/>
            <!-- Direction cone — points up, rotates with bearing -->
            <g transform="rotate(${bearing} 28 28)">
              <path d="M28 4 L22 22 L28 17 L34 22 Z"
                fill="#6aff9a"
                opacity="0.92"/>
              <path d="M28 4 L22 22 L28 17 L34 22 Z"
                fill="none"
                stroke="rgba(255,255,255,0.35)"
                stroke-width="0.8"
                stroke-linejoin="round"/>
            </g>
            <!-- White halo under dot -->
            <circle cx="28" cy="28" r="11"
              fill="white"
              opacity="0.15"/>
            <!-- Dot -->
            <circle cx="28" cy="28" r="8"
              fill="#4a7c59"
              stroke="white"
              stroke-width="3"
              style="filter:drop-shadow(0 2px 6px rgba(0,0,0,0.7))"/>
            <!-- Dot inner highlight -->
            <circle cx="26" cy="26" r="2.5"
              fill="rgba(255,255,255,0.45)"/>
          </svg>`;
        userMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([userLocation.lng, userLocation.lat])
          .addTo(mapRef.current);

        // Smooth camera follow during navigation
        if (followUser) {
          mapRef.current.easeTo({
            center:  [userLocation.lng, userLocation.lat],
            pitch:   52,
            bearing: bearingRef.current,
            zoom:    16.5,
            duration: 700,
            easing: (t: number) => 1 - Math.pow(1 - t, 3),
          });
        }
      });
    };
    if (!mapRef.current) setTimeout(run, 1000); else run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation?.lat, userLocation?.lng, followUser]);

  // ── Route layers + pitch ──────────────────────────────────────────────────
  useEffect(() => {
    const run = () => {
      if (!mapRef.current || !mapReadyRef.current) return;
      import("mapbox-gl").then((mod) => {
        const mapboxgl = mod.default;

        // Clear old route markers
        routeMarkersRef.current.forEach((m) => m.remove());
        routeMarkersRef.current = [];

        // Update walking GeoJSON
        const src = mapRef.current.getSource("walking") as any;
        if (src) {
          src.setData(
            walkingGeoJSON ?? { type: "FeatureCollection", features: [] }
          );
        }

        const hasRoute = !!(boardingStop || destCoords);
        hasRouteRef.current = hasRoute;

        const lngs: number[] = [];
        const lats: number[] = [];

        if (boardingStop) {
          const el = document.createElement("div");
          el.innerHTML = `
            <div style="
              background:#4a7c59;color:white;
              width:42px;height:42px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);
              border:2.5px solid white;box-shadow:0 4px 16px rgba(74,124,89,.55),0 2px 6px rgba(0,0,0,.5);
              display:flex;align-items:center;justify-content:center;font-size:19px;">
              <span style="transform:rotate(45deg)">🚐</span>
            </div>`;
          const m = new mapboxgl.Marker({ element: el, anchor: "bottom-left" })
            .setLngLat([boardingStop.lng, boardingStop.lat])
            .setPopup(new mapboxgl.Popup({ offset: 30 })
              .setHTML(`<b>${boardingStop.name}</b><br>Board here`))
            .addTo(mapRef.current);
          routeMarkersRef.current.push(m);
          lngs.push(boardingStop.lng); lats.push(boardingStop.lat);
        }

        if (destCoords) {
          const el = document.createElement("div");
          el.innerHTML = `
            <div style="
              background:#f0c040;color:#1a1200;
              width:36px;height:36px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);
              border:2px solid white;box-shadow:0 4px 16px rgba(240,192,64,.4),0 2px 6px rgba(0,0,0,.5);
              display:flex;align-items:center;justify-content:center;font-size:17px;">
              <span style="transform:rotate(45deg)">📍</span>
            </div>`;
          const m = new mapboxgl.Marker({ element: el, anchor: "bottom-left" })
            .setLngLat([destCoords.lng, destCoords.lat])
            .setPopup(new mapboxgl.Popup({ offset: 28 }).setText("Your destination"))
            .addTo(mapRef.current);
          routeMarkersRef.current.push(m);
          lngs.push(destCoords.lng); lats.push(destCoords.lat);
        }

        if (userLocation) { lngs.push(userLocation.lng); lats.push(userLocation.lat); }

        if (lngs.length > 1) {
          // Fit bounds with tilt
          const sw: [number, number] = [Math.min(...lngs), Math.min(...lats)];
          const ne: [number, number] = [Math.max(...lngs), Math.max(...lats)];
          mapRef.current.fitBounds([sw, ne], {
            padding: { top: 80, bottom: 100, left: 60, right: 60 },
            maxZoom: 15,
            pitch:   hasRoute ? 36 : 0,
            bearing: 0,
            duration: 950,
            easing: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
          });
        } else if (lngs.length === 1) {
          mapRef.current.easeTo({
            center:  [lngs[0], lats[0]],
            zoom:    15,
            pitch:   hasRoute ? 36 : 0,
            duration: 800,
          });
        } else {
          // No route — reset pitch
          mapRef.current.easeTo({ pitch: 0, bearing: 0, duration: 600 });
        }
      });
    };

    if (!mapReadyRef.current) setTimeout(run, 1200); else run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardingStop?.lat, boardingStop?.lng, destCoords?.lat, destCoords?.lng, walkingGeoJSON]);

  // ── No token fallback ─────────────────────────────────────────────────────
  if (!TOKEN) {
    return (
      <div className="relative w-full h-full rounded-2xl overflow-hidden border border-[#1e2e1c] bg-surface-card flex flex-col items-center justify-center gap-2">
        <span className="text-2xl">🗺️</span>
        <p className="text-content-muted text-xs text-center px-4">
          Add <code className="text-accent">NEXT_PUBLIC_MAPBOX_TOKEN</code> to enable the map
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-[#1e2e1c]">
      <style>{`
        @keyframes sfping {
          0%   { transform:scale(1);  opacity:.28 }
          70%  { transform:scale(2.8);opacity:0   }
          100% { transform:scale(1);  opacity:0   }
        }
        .mapboxgl-ctrl-attrib {
          background: rgba(13,26,11,.75) !important;
          border-radius: 6px !important;
        }
        .mapboxgl-ctrl-attrib a { color: #6aff9a !important; }
        .mapboxgl-ctrl-attrib-button { display:none !important; }
        .mapboxgl-popup-content {
          background: #152213;
          color: #d4e8cc;
          border: 1px solid #2e4a2a;
          border-radius: 10px;
          padding: 9px 13px;
          font-size: 12px;
          box-shadow: 0 6px 24px rgba(0,0,0,.7);
        }
        .mapboxgl-popup-tip {
          border-top-color:    #152213 !important;
          border-bottom-color: #152213 !important;
        }
        .mapboxgl-popup-close-button { color: #6aff9a; font-size: 16px; }
      `}</style>
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}

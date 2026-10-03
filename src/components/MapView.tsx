"use client";

import { useEffect, useRef } from "react";
import {
  Map as MlMap,
  Marker,
  NavigationControl,
  setWorkerUrl,
  setWorkerCount,
  type MapMouseEvent,
  type StyleSpecification,
} from "maplibre-gl";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { LineLayer } from "@deck.gl/layers";
import type { Layer } from "@deck.gl/core";
import { JAIPUR_BBOX, JAIPUR_CENTER, type LngLat } from "../lib/graph/geo";
import type { Playback } from "../lib/playback";
import { PALETTES, traceLayers, type Hue, type PreparedTrace } from "./trace-layers";

const STYLE_URL = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

// Explicitly register local worker URL to prevent Next.js / Turbopack bundle path issues
if (typeof window !== "undefined") {
  setWorkerUrl("/maplibre-gl-worker.mjs");
  setWorkerCount(2);
}

// Default self-contained white map style that never fails offline or behind firewalls
const DEFAULT_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: {
        "background-color": "#FFFFFF",
      },
    },
  ],
};

export interface MapViewProps {
  trace: PreparedTrace | null;
  frontierSizes: Int32Array | null;
  baseRoads?: Float32Array | null;
  routeHue: Hue | "accent";
  playback: Playback;
  start: LngLat | null;
  end: LngLat | null;
  onMapClick: (p: LngLat) => void;
  onMap?: (map: MlMap | null) => void;
  caption?: { text: string; hue: Hue };
}

const ACCENT: [number, number, number] = [194, 65, 12];

function createPinElement(label: string): HTMLElement {
  const pin = document.createElement("div");
  pin.className = `mg-pin mg-pin-${label.toLowerCase()}`;
  pin.setAttribute("aria-label", label === "A" ? "Start point" : "End point");

  const badge = document.createElement("div");
  badge.className = "mg-pin-badge";
  badge.textContent = label;

  const stem = document.createElement("div");
  stem.className = "mg-pin-stem";

  const dot = document.createElement("div");
  dot.className = "mg-pin-dot";

  pin.appendChild(badge);
  pin.appendChild(stem);
  pin.appendChild(dot);
  return pin;
}

export default function MapView({
  trace,
  frontierSizes,
  baseRoads,
  routeHue,
  playback,
  start,
  end,
  onMapClick,
  onMap,
  caption,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const markersRef = useRef<{ a: Marker | null; b: Marker | null }>({ a: null, b: null });
  const clickRef = useRef(onMapClick);
  const onMapRef = useRef(onMap);

  useEffect(() => {
    clickRef.current = onMapClick;
    onMapRef.current = onMap;
  });

  // Create the map once
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const pad = 0.08;

    // Start with the local paper style so initialization is instantaneous and 100% reliable
    const map = new MlMap({
      container,
      style: DEFAULT_STYLE,
      maxCanvasSize: [4096, 4096],
      center: [JAIPUR_CENTER.lng, JAIPUR_CENTER.lat],
      zoom: 10.8,
      minZoom: 9.0,
      maxZoom: 18,
      maxBounds: [
        [JAIPUR_BBOX.west - pad, JAIPUR_BBOX.south - pad],
        [JAIPUR_BBOX.east + pad, JAIPUR_BBOX.north + pad],
      ],
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new NavigationControl({ showCompass: false }), "bottom-right");

    const overlay = new MapboxOverlay({ interleaved: false, layers: [] });
    map.addControl(overlay);
    map.on("click", (e: MapMouseEvent) => clickRef.current({ lng: e.lngLat.lng, lat: e.lngLat.lat }));

    mapRef.current = map;
    overlayRef.current = overlay;
    onMapRef.current?.(map);

    // Asynchronously try to load CARTO Positron if online and accessible
    fetch(STYLE_URL)
      .then((res) => {
        if (!res.ok) throw new Error("CARTO style unavailable");
        return res.json();
      })
      .then(async (cartoStyle) => {
        // Verify vector tiles are also reachable before applying style
        const tileCheck = await fetch(
          "https://tiles.basemaps.cartocdn.com/vector/carto.streets/v1/0/0/0.mvt",
          { signal: AbortSignal.timeout(1500) }
        ).catch(() => null);
        if (tileCheck && tileCheck.ok && mapRef.current) {
          mapRef.current.setStyle(cartoStyle);
        }
      })
      .catch(() => {
        // Fallback paper style is already active
      });

    // Dedicated markers container that sits on top of all canvas layers (MapLibre + Deck.gl)
    const markerLayer = document.createElement("div");
    markerLayer.className = "mg-markers-layer";
    container.appendChild(markerLayer);

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(container);
    requestAnimationFrame(() => map.resize());

    const markers = markersRef.current;
    return () => {
      ro.disconnect();
      onMapRef.current?.(null);
      markers.a?.remove();
      markers.b?.remove();
      markers.a = null;
      markers.b = null;
      markerLayer.remove();
      map.removeControl(overlay);
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
    };
  }, []);

  // Start / end markers and viewport framing
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const sync = (key: "a" | "b", p: LngLat | null) => {
      const existing = markersRef.current[key];
      if (!p) {
        existing?.remove();
        markersRef.current[key] = null;
        return;
      }
      if (existing) {
        existing.setLngLat([p.lng, p.lat]);
      } else {
        const marker = new Marker({
          element: createPinElement(key.toUpperCase()),
          anchor: "bottom",
          offset: [0, 3],
        });
        marker.setLngLat([p.lng, p.lat]).addTo(map);
        const layer = containerRef.current?.querySelector(".mg-markers-layer");
        if (layer) {
          layer.appendChild(marker.getElement());
        }
        markersRef.current[key] = marker;
      }
    };
    sync("a", start);
    sync("b", end);

    // Auto-frame map to ensure selected markers are in view
    if (start && end) {
      const minLng = Math.min(start.lng, end.lng);
      const maxLng = Math.max(start.lng, end.lng);
      const minLat = Math.min(start.lat, end.lat);
      const maxLat = Math.max(start.lat, end.lat);
      map.fitBounds(
        [
          [minLng, minLat],
          [maxLng, maxLat],
        ],
        { padding: 80, maxZoom: 14, duration: 750 }
      );
    } else if (start && !end) {
      map.easeTo({ center: [start.lng, start.lat], duration: 600 });
    } else if (!start && end) {
      map.easeTo({ center: [end.lng, end.lat], duration: 600 });
    }
  }, [start, end]);

  // Per-frame layer updates, driven by the playback clock
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const routeColor = routeHue === "accent" ? ACCENT : PALETTES[routeHue].deep;

    const draw = () => {
      const layers: Layer[] = [];

      // Always draw the base road network if provided
      if (baseRoads && baseRoads.length > 0) {
        layers.push(
          new LineLayer({
            id: "base-roads",
            data: {
              length: baseRoads.length / 4,
              attributes: {
                getSourcePosition: { value: baseRoads, size: 2, stride: 16, offset: 0 },
                getTargetPosition: { value: baseRoads, size: 2, stride: 16, offset: 8 },
              },
            },
            widthUnits: "pixels",
            getWidth: 0.85,
            getColor: [220, 224, 228, 230],
            parameters: { depthCompare: "always" },
          })
        );
      }

      // Draw search simulation trace
      if (trace) {
        const drawn = playback.explored(trace.steps);
        const size = drawn > 0 && frontierSizes ? frontierSizes[drawn - 1] : 0;
        const frontierLen = Math.min(4000, Math.max(24, Math.round(size * 0.6)));
        layers.push(...traceLayers(trace, drawn, frontierLen, playback.routeProgress(trace.steps), routeColor));
      }

      overlay.setProps({ layers });
    };

    draw();
    return playback.subscribe(draw);
  }, [trace, frontierSizes, baseRoads, routeHue, playback]);

  return (
    <div className="map-frame">
      <div ref={containerRef} className="map-canvas" />
      {caption ? (
        <div className="map-caption">
          <span className={`swatch swatch-${caption.hue}`} aria-hidden />
          {caption.text}
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { DEFAULT_BBOX, DEFAULT_CENTER, type LngLat } from "../lib/graph/geo";
import type { Playback } from "../lib/playback";
import { PALETTES, SATELLITE_PALETTES, traceLayers, type Hue, type PreparedTrace } from "./trace-layers";

export type MapStyleId = "streets" | "satellite";

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

// High-resolution satellite raster basemap with hybrid boundaries & labels
export const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    "esri-satellite": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution:
        "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
    },
    "esri-reference": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: "satellite-bg",
      type: "background",
      paint: {
        "background-color": "#0a1118",
      },
    },
    {
      id: "satellite-imagery",
      type: "raster",
      source: "esri-satellite",
      minzoom: 0,
      maxzoom: 22,
    },
    {
      id: "satellite-reference",
      type: "raster",
      source: "esri-reference",
      minzoom: 0,
      maxzoom: 22,
      paint: {
        "raster-opacity": 0.85,
      },
    },
  ],
};

let cachedCartoStyle: StyleSpecification | null = null;
let cartoStyleLoading = false;
const cartoWaiters: ((s: StyleSpecification | null) => void)[] = [];

function requestCartoStyle(callback: (s: StyleSpecification | null) => void) {
  if (cachedCartoStyle) {
    callback(cachedCartoStyle);
    return;
  }
  cartoWaiters.push(callback);
  if (cartoStyleLoading) return;
  cartoStyleLoading = true;
  fetch(STYLE_URL)
    .then((res) => {
      if (!res.ok) throw new Error("CARTO style unavailable");
      return res.json();
    })
    .then(async (cartoStyle) => {
      const tileCheck = await fetch(
        "https://tiles.basemaps.cartocdn.com/vector/carto.streets/v1/0/0/0.mvt",
        { signal: AbortSignal.timeout(1500) }
      ).catch(() => null);
      if (tileCheck && tileCheck.ok) {
        cachedCartoStyle = cartoStyle;
        while (cartoWaiters.length > 0) cartoWaiters.shift()?.(cartoStyle);
      } else {
        while (cartoWaiters.length > 0) cartoWaiters.shift()?.(null);
      }
    })
    .catch(() => {
      while (cartoWaiters.length > 0) cartoWaiters.shift()?.(null);
    })
    .finally(() => {
      cartoStyleLoading = false;
    });
}

function ensureSatelliteLayers(map: MlMap, isSat: boolean) {
  if (!map.isStyleLoaded()) return;

  if (!map.getSource("esri-satellite")) {
    map.addSource("esri-satellite", SATELLITE_STYLE.sources["esri-satellite"]);
  }
  if (!map.getSource("esri-reference")) {
    map.addSource("esri-reference", SATELLITE_STYLE.sources["esri-reference"]);
  }

  if (!map.getLayer("satellite-imagery")) {
    map.addLayer({
      id: "satellite-imagery",
      type: "raster",
      source: "esri-satellite",
      minzoom: 0,
      maxzoom: 22,
      paint: {
        "raster-opacity": isSat ? 1 : 0,
        "raster-opacity-transition": { duration: 400, delay: 0 },
      },
    });
  }

  if (!map.getLayer("satellite-reference")) {
    map.addLayer({
      id: "satellite-reference",
      type: "raster",
      source: "esri-reference",
      minzoom: 0,
      maxzoom: 22,
      paint: {
        "raster-opacity": isSat ? 0.85 : 0,
        "raster-opacity-transition": { duration: 400, delay: 0 },
      },
    });
  }
}

export interface MapViewProps {
  mapStyle?: MapStyleId;
  onMapStyleChange?: (style: MapStyleId) => void;
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
  mapStyle: controlledStyle,
  onMapStyleChange,
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
  const [internalStyle, setInternalStyle] = useState<MapStyleId>("streets");
  const activeStyle = controlledStyle ?? internalStyle;

  const handleStyleChange = useCallback(
    (newStyle: MapStyleId) => {
      if (controlledStyle === undefined) {
        setInternalStyle(newStyle);
      }
      onMapStyleChange?.(newStyle);
    },
    [controlledStyle, onMapStyleChange]
  );

  const activeStyleRef = useRef(activeStyle);
  useEffect(() => {
    activeStyleRef.current = activeStyle;
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const markersRef = useRef<{ a: Marker | null; b: Marker | null }>({ a: null, b: null });
  const clickRef = useRef(onMapClick);
  const onMapRef = useRef(onMap);
  const drawRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    clickRef.current = onMapClick;
    onMapRef.current = onMap;
  });

  // Create the map once
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const pad = 0.08;

    // Use Carto streets style or default as base, layering satellite on top
    const initialStyle = cachedCartoStyle || DEFAULT_STYLE;

    const map = new MlMap({
      container,
      style: initialStyle,
      maxCanvasSize: [4096, 4096],
      center: [DEFAULT_CENTER.lng, DEFAULT_CENTER.lat],
      zoom: 10.8,
      minZoom: 9.0,
      maxZoom: 18,
      maxBounds: [
        [DEFAULT_BBOX.west - pad, DEFAULT_BBOX.south - pad],
        [DEFAULT_BBOX.east + pad, DEFAULT_BBOX.north + pad],
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

    // Ensure satellite layers exist on any style update, and redraw deck.gl
    map.on("styledata", () => {
      ensureSatelliteLayers(map, activeStyleRef.current === "satellite");
      drawRef.current?.();
    });

    map.on("load", () => {
      ensureSatelliteLayers(map, activeStyleRef.current === "satellite");
    });

    mapRef.current = map;
    overlayRef.current = overlay;
    onMapRef.current?.(map);

    // If starting in streets mode and CARTO Positron isn't cached yet, fetch it
    if (!cachedCartoStyle) {
      requestCartoStyle((cartoStyle) => {
        if (cartoStyle && mapRef.current) {
          mapRef.current.setStyle(cartoStyle);
        }
      });
    }

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

  // Smoothly cross-fade satellite raster layer on/off when activeStyle changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const isSat = activeStyle === "satellite";
    if (map.getLayer("satellite-imagery")) {
      map.setPaintProperty("satellite-imagery", "raster-opacity", isSat ? 1 : 0);
    } else {
      ensureSatelliteLayers(map, isSat);
    }

    if (map.getLayer("satellite-reference")) {
      map.setPaintProperty("satellite-reference", "raster-opacity", isSat ? 0.85 : 0);
    }
  }, [activeStyle]);

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

  // Per-frame layer updates, driven by the playback clock and activeStyle
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const isSat = activeStyle === "satellite";
    const routeColor =
      routeHue === "accent"
        ? ACCENT
        : isSat
        ? SATELLITE_PALETTES[routeHue].route
        : PALETTES[routeHue].deep;

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
            getWidth: isSat ? 0.95 : 0.85,
            getColor: isSat ? [255, 255, 255, 120] : [220, 224, 228, 230],
            parameters: { depthCompare: "always" },
          })
        );
      }

      // Draw search simulation trace
      if (trace) {
        const drawn = playback.explored(trace.steps);
        const size = drawn > 0 && frontierSizes ? frontierSizes[drawn - 1] : 0;
        const frontierLen = Math.min(4000, Math.max(24, Math.round(size * 0.6)));
        layers.push(
          ...traceLayers(
            trace,
            drawn,
            frontierLen,
            playback.routeProgress(trace.steps),
            routeColor,
            isSat
          )
        );
      }

      overlay.setProps({ layers });
    };

    drawRef.current = draw;
    draw();
    return playback.subscribe(draw);
  }, [trace, frontierSizes, baseRoads, routeHue, playback, activeStyle]);

  const captionId = caption?.text
    ? caption.text.toLowerCase().replace(/[^a-z0-9]+/g, "-")
    : "main";

  return (
    <div className="map-frame" data-style={activeStyle}>
      <div ref={containerRef} className="map-canvas" />
      {caption ? (
        <div className="map-caption">
          <span className={`swatch swatch-${caption.hue}`} aria-hidden />
          {caption.text}
        </div>
      ) : null}

      <div className="map-style-toggle" role="group" aria-label="Map style selection">
        <button
          type="button"
          id={`style-btn-streets-${captionId}`}
          className={`map-style-toggle-btn ${activeStyle === "streets" ? "active" : ""}`}
          onClick={() => handleStyleChange("streets")}
          aria-pressed={activeStyle === "streets"}
          title="Switch to Streets view (vector basemap)"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
            <line x1="8" y1="2" x2="8" y2="18" />
            <line x1="16" y1="6" x2="16" y2="22" />
          </svg>
          <span>Streets</span>
        </button>
        <button
          type="button"
          id={`style-btn-satellite-${captionId}`}
          className={`map-style-toggle-btn ${activeStyle === "satellite" ? "active" : ""}`}
          onClick={() => handleStyleChange("satellite")}
          aria-pressed={activeStyle === "satellite"}
          title="Switch to Satellite view (aerial imagery)"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
            <path d="M2 12h20" />
          </svg>
          <span>Satellite</span>
        </button>
      </div>
    </div>
  );
}

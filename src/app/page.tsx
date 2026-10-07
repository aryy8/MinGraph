"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Map as MlMap, LngLatBoundsLike } from "maplibre-gl";

import { loadGraph, type RoadGraph } from "../lib/graph/load";
import { SpatialIndex } from "../lib/graph/spatial-index";
import { insideBbox, type LngLat } from "../lib/graph/geo";
import { ALGORITHMS, algorithmInfo, type AlgorithmId, type RunResult } from "../lib/algorithms/types";
import { runAlgorithm } from "../lib/algorithms/pool";
import { Playback } from "../lib/playback";
import { prepareTrace, type PreparedTrace } from "../components/trace-layers";
import { Segmented, type SegmentOption } from "../components/Segmented";
import { PointPicker, type SelectedPoint } from "../components/PointPicker";
import { PlaybackPanel } from "../components/PlaybackPanel";
import { LiveStats, type StatColumn } from "../components/LiveStats";
import { CompareResults } from "../components/CompareResults";
import { syncMaps } from "../lib/sync-maps";
import { fmtDuration, fmtKm } from "../lib/format";
import type { MapStyleId } from "../components/MapView";
import {
  MinGraphLogo,
  ChevronLeftIcon,
  ChevronRightIcon,
  DirectionsIcon,
  AlgorithmIcon,
  ModeCompareIcon,
  LayersIcon,
  StatsChartIcon,
  PlayIcon,
  PauseIcon,
} from "../components/icons";
import { SidebarRail } from "../components/SidebarRail";

// MapView must be loaded client-side only (MapLibre and WebGL require window)
const MapView = dynamic(() => import("../components/MapView"), {
  ssr: false,
  loading: () => <div className="map-frame" />,
});

function extractBaseRoads(graph: RoadGraph): Float32Array {
  const coords = graph.coords;
  const off = graph.offsets;
  const tgt = graph.targets;
  const segs = new Float32Array(graph.m * 4);
  let p = 0;
  for (let u = 0; u < graph.n; u++) {
    const x0 = coords[2 * u];
    const y0 = coords[2 * u + 1];
    const end = off[u + 1];
    for (let e = off[u]; e < end; e++) {
      const v = tgt[e];
      if (u < v) {
        segs[p++] = x0;
        segs[p++] = y0;
        segs[p++] = coords[2 * v];
        segs[p++] = coords[2 * v + 1];
      }
    }
  }
  return segs.subarray(0, p);
}

type Mode = "simulate" | "compare";

const MODE_OPTIONS: readonly SegmentOption<Mode>[] = [
  { value: "simulate", label: "Simulate" },
  { value: "compare", label: "Compare" },
];

const STYLE_OPTIONS: readonly SegmentOption<MapStyleId>[] = [
  { value: "streets", label: "Streets" },
  { value: "satellite", label: "Satellite" },
];

const ALGO_OPTIONS: readonly SegmentOption<AlgorithmId>[] = ALGORITHMS.map((a) => ({
  value: a.id,
  label: a.name,
}));

export default function MinGraphApp() {
  const [graph, setGraph] = useState<RoadGraph | null>(null);
  const [graphError, setGraphError] = useState<string | null>(null);
  const [spatialIndex, setSpatialIndex] = useState<SpatialIndex | null>(null);

  const [mode, setMode] = useState<Mode>("simulate");
  const [simAlgo, setSimAlgo] = useState<AlgorithmId>("astar");
  const [compareAlgos, setCompareAlgos] = useState<[AlgorithmId, AlgorithmId]>(["dijkstra", "astar"]);
  const [collapsed, setCollapsed] = useState(false);

  const [startPoint, setStartPoint] = useState<SelectedPoint | null>(null);
  const [endPoint, setEndPoint] = useState<SelectedPoint | null>(null);

  const [mapStyle, setMapStyle] = useState<MapStyleId>("streets");
  const [map2Style, setMap2Style] = useState<MapStyleId>("streets");

  const handleGlobalMapStyleChange = (s: MapStyleId) => {
    setMapStyle(s);
    setMap2Style(s);
  };

  const [running, setRunning] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Results
  const [simResult, setSimResult] = useState<RunResult | null>(null);
  const [allResults, setAllResults] = useState<Record<AlgorithmId, RunResult> | null>(null);

  // Road network segments for base cartography
  const baseRoads = useMemo(() => (graph ? extractBaseRoads(graph) : null), [graph]);

  // Playback engine
  const playback = useMemo(() => new Playback(), []);

  // Map references
  const map1Ref = useRef<MlMap | null>(null);
  const map2Ref = useRef<MlMap | null>(null);

  // Resize maps when sidebar is collapsed or expanded
  useEffect(() => {
    const timer = setTimeout(() => {
      map1Ref.current?.resize();
      map2Ref.current?.resize();
    }, 260);
    return () => clearTimeout(timer);
  }, [collapsed]);

  // Load the graph once on mount
  useEffect(() => {
    loadGraph()
      .then((g) => {
        setGraph(g);
        setSpatialIndex(new SpatialIndex(g.coords));
      })
      .catch((err) => {
        setGraphError(err instanceof Error ? err.message : "Failed to load road graph data");
      });
  }, []);

  // Camera synchronization in Compare mode
  useEffect(() => {
    if (mode !== "compare") return;
    return syncMaps(map1Ref.current, map2Ref.current);
  }, [mode, map1Ref.current, map2Ref.current]);

  // Keyboard shortcut: Space toggles play/pause, [ or Ctrl+B toggles sidebar
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        playback.toggle();
      } else if (e.key === "[" || (e.ctrlKey && e.key === "b")) {
        e.preventDefault();
        setCollapsed((c) => !c);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [playback]);

  // Snapping function: snaps any selected location to the road network
  const handleSnap = useCallback(
    (coords: LngLat): { nodeId: number; snapDistance: number } | null => {
      if (!spatialIndex || !graph) return null;
      const match = spatialIndex.nearest(coords.lng, coords.lat);
      if (!match) {
        setStatusMessage("Could not locate a road near this position.");
        return null;
      }
      if (match.distance > 60000) {
        setStatusMessage(`Selected location is too far from road network (${fmtKm(match.distance)}).`);
        return null;
      }
      if (match.distance > 2500) {
        setStatusMessage(`Location snapped ${fmtKm(match.distance)} to nearest road in network.`);
      } else {
        setStatusMessage(null);
      }
      return { nodeId: match.node, snapDistance: match.distance };
    },
    [spatialIndex, graph]
  );

  // Map click handler (sets start first, then end)
  const handleMapClick = useCallback(
    (p: LngLat) => {
      const snap = handleSnap(p);
      if (!snap) return;
      const point: SelectedPoint = {
        label: `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`,
        coords: p,
        nodeId: snap.nodeId,
        snapDistance: snap.snapDistance,
      };
      if (!startPoint) {
        setStartPoint(point);
        setStatusMessage(null);
      } else if (!endPoint) {
        setEndPoint(point);
        setStatusMessage(null);
      } else {
        // Both were set; cycle start to new point and clear end
        setStartPoint(point);
        setEndPoint(null);
        setStatusMessage(null);
      }
    },
    [handleSnap, startPoint, endPoint]
  );

  const handleSwap = () => {
    setStartPoint(endPoint);
    setEndPoint(startPoint);
  };

  // Helper to fit map bounds to the route
  const fitRouteToBounds = useCallback((pathCoords: Float32Array) => {
    const map = map1Ref.current;
    if (!map || pathCoords.length < 4) return;
    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;
    const n = pathCoords.length / 2;
    for (let i = 0; i < n; i++) {
      const lng = pathCoords[2 * i];
      const lat = pathCoords[2 * i + 1];
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    const bounds: LngLatBoundsLike = [
      [minLng, minLat],
      [maxLng, maxLat],
    ];
    map.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 900 });
  }, []);

  // Listen for playback finish to fit map to route in simulate mode
  useEffect(() => {
    return playback.onFinish(() => {
      if (mode === "simulate" && simResult && simResult.found) {
        fitRouteToBounds(simResult.pathCoords);
      }
    });
  }, [playback, mode, simResult, fitRouteToBounds]);

  // Run execution
  const handleRun = async () => {
    if (!graph || !startPoint || !endPoint) return;
    setRunning(true);
    setStatusMessage(null);
    playback.clear();

    const src = startPoint.nodeId;
    const dst = endPoint.nodeId;

    try {
      if (mode === "simulate") {
        const res = await runAlgorithm(graph, simAlgo, src, dst);
        setSimResult(res);
        if (!res.found) {
          setStatusMessage("No route found between selected points.");
        } else {
          playback.load(res.steps);
        }
      } else {
        // Compare mode: run all 4 algorithms in parallel workers
        const promises = ALGORITHMS.map((algo) => runAlgorithm(graph, algo.id, src, dst));
        const results = await Promise.all(promises);
        const mapRes: Record<AlgorithmId, RunResult> = {
          dijkstra: results[0],
          astar: results[1],
          bfs: results[2],
          bidirectional: results[3],
        };
        setAllResults(mapRes);

        const r1 = mapRes[compareAlgos[0]];
        const r2 = mapRes[compareAlgos[1]];
        if (!r1.found && !r2.found) {
          setStatusMessage("No route found between selected points.");
        } else {
          const maxSteps = Math.max(r1.steps, r2.steps);
          playback.load(maxSteps);
        }
      }
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Error executing search");
    } finally {
      setRunning(false);
    }
  };

  // Prepared deck.gl traces
  const simTrace: PreparedTrace | null = useMemo(() => {
    if (!simResult) return null;
    return prepareTrace(simResult, "blue", mapStyle === "satellite");
  }, [simResult, mapStyle]);

  const compareTrace1: PreparedTrace | null = useMemo(() => {
    if (!allResults) return null;
    return prepareTrace(allResults[compareAlgos[0]], "blue", mapStyle === "satellite");
  }, [allResults, compareAlgos, mapStyle]);

  const compareTrace2: PreparedTrace | null = useMemo(() => {
    if (!allResults) return null;
    return prepareTrace(allResults[compareAlgos[1]], "terra", map2Style === "satellite");
  }, [allResults, compareAlgos, map2Style]);

  const liveColumns: StatColumn[] = useMemo(() => {
    if (mode === "simulate") {
      return simResult ? [{ result: simResult }] : [];
    } else {
      if (!allResults) return [];
      return [
        { result: allResults[compareAlgos[0]], hue: "blue" },
        { result: allResults[compareAlgos[1]], hue: "terra" },
      ];
    }
  }, [mode, simResult, allResults, compareAlgos]);

  const primaryResult = mode === "simulate" ? simResult : allResults ? allResults[compareAlgos[0]] : null;

  const activeAlgoName = useMemo(() => {
    return ALGORITHMS.find((a) => a.id === (mode === "simulate" ? simAlgo : compareAlgos[0]))?.name || "A*";
  }, [mode, simAlgo, compareAlgos]);

  const activeAlgoShort = useMemo(() => {
    if (mode === "compare") return "COMP";
    return simAlgo === "astar" ? "A*" : simAlgo === "dijkstra" ? "DIJ" : simAlgo === "bfs" ? "BFS" : "BI";
  }, [mode, simAlgo]);

  return (
    <div className="app-container">
      <aside className={`sidebar ${collapsed ? "sidebar-collapsed" : ""}`}>
        {collapsed ? (
          <SidebarRail
            onExpand={() => setCollapsed(false)}
            startPoint={startPoint}
            endPoint={endPoint}
            mode={mode}
            onToggleMode={() => {
              setMode(mode === "simulate" ? "compare" : "simulate");
              playback.clear();
              setStatusMessage(null);
            }}
            algorithmName={activeAlgoName}
            algorithmShort={activeAlgoShort}
            mapStyle={mapStyle}
            onToggleMapStyle={() => {
              const next = mapStyle === "streets" ? "satellite" : "streets";
              setMapStyle(next);
              setMap2Style(next);
            }}
            running={running}
            playing={playback.playing}
            hasResult={Boolean(simResult || allResults)}
            onRunOrTogglePlay={() => {
              if (!simResult && !allResults) {
                handleRun();
              } else {
                playback.toggle();
              }
            }}
            canRun={Boolean(graph && (startPoint || endPoint))}
            primaryResult={primaryResult}
          />
        ) : (
          <>
            <header className="app-header">
              <div className="brand-lockup">
                <div className="google-brand-mark" aria-hidden="true">
                  <MinGraphLogo size={24} />
                </div>
                <div className="brand-text">
                  <div className="brand-title-wrap">
                    <h1 className="brand-title">MinGraph</h1>
                    <span className="google-chip">Maps Lab</span>
                  </div>
                  <p className="brand-subtitle">Road Network Pathfinding</p>
                </div>
                <button
                  type="button"
                  className="sidebar-toggle-btn"
                  onClick={() => setCollapsed(true)}
                  title="Collapse side panel (Ctrl+[)"
                  aria-label="Collapse side panel"
                >
                  <ChevronLeftIcon />
                </button>
              </div>
            </header>

        {graphError ? (
          <div className="sidebar-section">
            <div className="message-banner message-banner-error">{graphError}</div>
          </div>
        ) : null}

        <div className="sidebar-section">
          <span className="spec-label">Mode</span>
          <Segmented
            id="mode-picker"
            label="Visualizer Mode"
            value={mode}
            options={MODE_OPTIONS}
            onChange={(m) => {
              setMode(m);
              playback.clear();
              setStatusMessage(null);
            }}
          />
        </div>

        {mode === "simulate" ? (
          <div className="sidebar-section">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span className="spec-label" style={{ marginBottom: 0 }}>Algorithm</span>
              <code className="complexity-badge">{algorithmInfo(simAlgo).timeComplexity}</code>
            </div>
            <Segmented
              id="algo-picker"
              label="Pathfinding Algorithm"
              value={simAlgo}
              options={ALGO_OPTIONS}
              onChange={(a) => {
                setSimAlgo(a);
                playback.clear();
              }}
            />
          </div>
        ) : (
          <div className="sidebar-section">
            <span className="spec-label">Compare Algorithms</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div>
                <span className="spec-label" style={{ fontSize: 9, marginBottom: 4 }}>
                  <span className="swatch swatch-blue" aria-hidden /> Map 1 (Blue)
                </span>
                <Segmented
                  id="compare-1"
                  label="Algorithm 1"
                  value={compareAlgos[0]}
                  options={ALGORITHMS.map((a) => ({
                    value: a.id,
                    label: a.short,
                    disabled: a.id === compareAlgos[1],
                  }))}
                  onChange={(a) => setCompareAlgos([a, compareAlgos[1]])}
                />
              </div>
              <div>
                <span className="spec-label" style={{ fontSize: 9, marginBottom: 4 }}>
                  <span className="swatch swatch-terra" aria-hidden /> Map 2 (Red)
                </span>
                <Segmented
                  id="compare-2"
                  label="Algorithm 2"
                  value={compareAlgos[1]}
                  options={ALGORITHMS.map((a) => ({
                    value: a.id,
                    label: a.short,
                    disabled: a.id === compareAlgos[0],
                  }))}
                  onChange={(a) => setCompareAlgos([compareAlgos[0], a])}
                />
              </div>
            </div>
          </div>
        )}

        <div className="sidebar-section">
          <span className="spec-label">Map Style</span>
          <Segmented
            id="map-style-picker"
            label="Map Style"
            value={mapStyle}
            options={STYLE_OPTIONS}
            onChange={handleGlobalMapStyleChange}
          />
        </div>

        <div className="sidebar-section">
          <span className="spec-label">Waypoints</span>
          <PointPicker
            start={startPoint}
            end={endPoint}
            onSelectStart={setStartPoint}
            onSelectEnd={setEndPoint}
            onSwap={handleSwap}
            onSnap={handleSnap}
            disabled={!graph || running}
          />
        </div>

        <div className="sidebar-section">
          <button
            type="button"
            id="run-btn"
            className="primary-btn"
            disabled={!graph || !startPoint || !endPoint || running}
            onClick={handleRun}
            title={
              !startPoint
                ? "Select a starting point"
                : !endPoint
                ? "Select a destination"
                : running
                ? "Finding optimal route..."
                : "Find optimal route"
            }
          >
            {running ? (
              <>
                <svg className="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                </svg>
                <span>Finding Route...</span>
              </>
            ) : (
              <>
                <DirectionsIcon />
                <span>{mode === "simulate" ? "Find Route" : "Run Comparison"}</span>
              </>
            )}
          </button>

          {statusMessage ? <div className="message-banner">{statusMessage}</div> : null}

          {primaryResult && primaryResult.found ? (
            <div className="route-summary-card">
              <div className="route-summary-top">
                <div className="route-time">{fmtDuration(primaryResult.distance)}</div>
                <div className="route-fastest-badge">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
                  <span>Fastest route</span>
                </div>
              </div>
              <div className="route-summary-meta">
                <span className="route-dist">{fmtKm(primaryResult.distance)}</span>
                <span className="route-meta-dot">•</span>
                <span>Road Network (~25 km/h)</span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="sidebar-section">
          <span className="spec-label">Playback Controls</span>
          <PlaybackPanel playback={playback} />
        </div>

        {liveColumns.length > 0 ? (
          <div className="sidebar-section">
            <span className="spec-label">Live Metrics</span>
            <LiveStats columns={liveColumns} playback={playback} />
          </div>
        ) : null}

        {mode === "compare" && allResults ? (
          <div className="sidebar-section">
            <CompareResults
              results={Object.values(allResults)}
              compareAlgos={compareAlgos}
            />
          </div>
        ) : null}

        <footer className="sidebar-footer">
          <div className="footer-meta">
            {graph ? (
              <>
                Road network: {graph.meta.nodes.toLocaleString()} nodes,{" "}
                {graph.meta.edges.toLocaleString()} edges ({graph.meta.totalEdgeLengthKm} km).{" "}
                {graph.meta.source}.
              </>
            ) : (
              "Loading road network..."
            )}
          </div>
        </footer>
          </>
        )}
      </aside>

      <main className="map-stage" data-mode={mode}>
        {mode === "simulate" ? (
          <MapView
            key="map-sim"
            mapStyle={mapStyle}
            onMapStyleChange={(s) => {
              setMapStyle(s);
              setMap2Style(s);
            }}
            baseRoads={baseRoads}
            trace={simTrace}
            frontierSizes={simResult ? simResult.frontier : null}
            routeHue="accent"
            playback={playback}
            start={startPoint ? startPoint.coords : null}
            end={endPoint ? endPoint.coords : null}
            onMapClick={handleMapClick}
            onMap={(m) => {
              map1Ref.current = m;
            }}
          />
        ) : (
          <>
            <MapView
              key={`map-c1-${compareAlgos[0]}`}
              mapStyle={mapStyle}
              onMapStyleChange={(s) => setMapStyle(s)}
              baseRoads={baseRoads}
              trace={compareTrace1}
              frontierSizes={allResults ? allResults[compareAlgos[0]].frontier : null}
              routeHue="blue"
              playback={playback}
              start={startPoint ? startPoint.coords : null}
              end={endPoint ? endPoint.coords : null}
              onMapClick={handleMapClick}
              onMap={(m) => {
                map1Ref.current = m;
              }}
              caption={{
                text: ALGORITHMS.find((a) => a.id === compareAlgos[0])?.name || "",
                hue: "blue",
              }}
            />
            <MapView
              key={`map-c2-${compareAlgos[1]}`}
              mapStyle={map2Style}
              onMapStyleChange={(s) => setMap2Style(s)}
              baseRoads={baseRoads}
              trace={compareTrace2}
              frontierSizes={allResults ? allResults[compareAlgos[1]].frontier : null}
              routeHue="terra"
              playback={playback}
              start={startPoint ? startPoint.coords : null}
              end={endPoint ? endPoint.coords : null}
              onMapClick={handleMapClick}
              onMap={(m) => {
                map2Ref.current = m;
              }}
              caption={{
                text: ALGORITHMS.find((a) => a.id === compareAlgos[1])?.name || "",
                hue: "terra",
              }}
            />
          </>
        )}
      </main>
    </div>
  );
}

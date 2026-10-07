"use client";

import {
  MinGraphLogo,
  ChevronRightIcon,
  DirectionsIcon,
  AlgorithmIcon,
  ModeCompareIcon,
  LayersIcon,
  StatsChartIcon,
  PlayIcon,
  PauseIcon,
} from "./icons";
import type { SelectedPoint } from "./PointPicker";
import type { RunResult } from "../lib/algorithms/types";
import type { MapStyleId } from "./MapView";
import { fmtKm } from "../lib/format";

export type Mode = "simulate" | "compare";

interface SidebarRailProps {
  onExpand: () => void;
  startPoint: SelectedPoint | null;
  endPoint: SelectedPoint | null;
  mode: Mode;
  onToggleMode: () => void;
  algorithmName: string;
  algorithmShort: string;
  mapStyle: MapStyleId;
  onToggleMapStyle: () => void;
  running: boolean;
  playing: boolean;
  hasResult: boolean;
  onRunOrTogglePlay: () => void;
  canRun: boolean;
  primaryResult: RunResult | null;
}

export function SidebarRail({
  onExpand,
  startPoint,
  endPoint,
  mode,
  onToggleMode,
  algorithmName,
  algorithmShort,
  mapStyle,
  onToggleMapStyle,
  running,
  playing,
  hasResult,
  onRunOrTogglePlay,
  canRun,
  primaryResult,
}: SidebarRailProps) {
  const hasRoute = Boolean(startPoint && endPoint);

  return (
    <div className="sidebar-rail" role="toolbar" aria-label="Sidebar Actions Rail">
      {/* Top: Expand button & Brand mark */}
      <div className="rail-top">
        <button
          type="button"
          className="rail-btn rail-expand-btn"
          onClick={onExpand}
          title="Expand side panel (Ctrl+[ or click)"
          aria-label="Expand side panel"
        >
          <ChevronRightIcon />
        </button>
        <div
          className="google-brand-mark rail-brand-mark"
          onClick={onExpand}
          title="MinGraph • Click to expand side panel"
          role="button"
          tabIndex={0}
        >
          <MinGraphLogo size={20} />
        </div>
      </div>

      <div className="rail-divider" />

      {/* Rail Navigation & Action Items */}
      <div className="rail-items">
        {/* 1. Directions / Waypoints */}
        <div className="rail-item-wrapper">
          <button
            type="button"
            className={`rail-btn ${startPoint || endPoint ? "rail-btn-active" : ""}`}
            onClick={onExpand}
            title={`Waypoints: ${startPoint ? startPoint.label : "Start"} → ${endPoint ? endPoint.label : "Destination"}`}
            aria-label="Route waypoints"
          >
            <DirectionsIcon />
            {hasRoute ? <span className="rail-indicator-dot" /> : null}
          </button>
          <span className="rail-item-label">Route</span>
        </div>

        {/* 2. Algorithm */}
        <div className="rail-item-wrapper">
          <button
            type="button"
            className="rail-btn"
            onClick={onExpand}
            title={`Algorithm: ${algorithmName}`}
            aria-label="Algorithm selection"
          >
            <AlgorithmIcon />
            <span className="rail-badge-text">{algorithmShort}</span>
          </button>
          <span className="rail-item-label">Algo</span>
        </div>

        {/* 3. Mode (Simulate vs Compare) */}
        <div className="rail-item-wrapper">
          <button
            type="button"
            className={`rail-btn ${mode === "compare" ? "rail-btn-active" : ""}`}
            onClick={onToggleMode}
            title={`Mode: ${mode === "simulate" ? "Simulate (Single Map)" : "Compare (Split Map)"} • Click to toggle`}
            aria-label="Toggle visualizer mode"
          >
            <ModeCompareIcon />
          </button>
          <span className="rail-item-label">{mode === "simulate" ? "Sim" : "Comp"}</span>
        </div>

        {/* 4. Map Style (Streets vs Satellite) */}
        <div className="rail-item-wrapper">
          <button
            type="button"
            className={`rail-btn ${mapStyle === "satellite" ? "rail-btn-active" : ""}`}
            onClick={onToggleMapStyle}
            title={`Map Style: ${mapStyle === "satellite" ? "Satellite" : "Streets"} • Click to toggle`}
            aria-label="Toggle map style"
          >
            <LayersIcon />
          </button>
          <span className="rail-item-label">{mapStyle === "satellite" ? "Sat" : "Map"}</span>
        </div>

        {/* 5. Primary Action: Run / Play / Pause */}
        <div className="rail-item-wrapper">
          <button
            type="button"
            className={`rail-btn rail-action-btn ${running ? "rail-action-running" : ""}`}
            disabled={!canRun}
            onClick={onRunOrTogglePlay}
            title={
              running
                ? "Finding route..."
                : playing
                ? "Pause simulation"
                : hasResult
                ? "Play simulation"
                : "Find Route"
            }
            aria-label="Run or play pathfinding"
          >
            {running ? (
              <span className="rail-spinner" />
            ) : playing ? (
              <PauseIcon />
            ) : (
              <PlayIcon />
            )}
          </button>
          <span className="rail-item-label">
            {running ? "Run" : playing ? "Pause" : hasResult ? "Play" : "Start"}
          </span>
        </div>

        {/* 6. Live Metrics / Stats */}
        <div className="rail-item-wrapper">
          <button
            type="button"
            className={`rail-btn ${primaryResult ? "rail-btn-has-data" : ""}`}
            onClick={onExpand}
            title={
              primaryResult
                ? `Metrics: ${fmtKm(primaryResult.distance)} in ${primaryResult.computeMs.toFixed(1)}ms`
                : "No simulation metrics yet"
            }
            aria-label="View performance metrics"
          >
            <StatsChartIcon />
            {primaryResult ? <span className="rail-indicator-dot rail-dot-success" /> : null}
          </button>
          <span className="rail-item-label">Stats</span>
        </div>
      </div>

      {/* Bottom expand button */}
      <div className="rail-bottom">
        <button
          type="button"
          className="rail-btn rail-expand-hint-btn"
          onClick={onExpand}
          title="Expand side panel"
          aria-label="Expand side panel"
        >
          <ChevronRightIcon />
        </button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { LANDMARKS, type Landmark, type LngLat } from "../lib/graph/geo";
import type { GeocodeResult } from "../app/api/geocode/route";
import { CloseIcon, SwapIcon } from "./icons";

export interface SelectedPoint {
  label: string;
  coords: LngLat;
  nodeId: number;
  snapDistance: number;
}

interface PointPickerProps {
  start: SelectedPoint | null;
  end: SelectedPoint | null;
  onSelectStart: (p: SelectedPoint | null) => void;
  onSelectEnd: (p: SelectedPoint | null) => void;
  onSwap: () => void;
  onSnap: (coords: LngLat) => { nodeId: number; snapDistance: number } | null;
  disabled?: boolean;
}

function AutocompleteInput({
  id,
  label,
  placeholder,
  value,
  selected,
  onSelect,
  onClear,
  onSnap,
  disabled,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  selected: SelectedPoint | null;
  onSelect: (p: SelectedPoint) => void;
  onClear: () => void;
  onSnap: (coords: LngLat) => { nodeId: number; snapDistance: number } | null;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setQuery(selected ? selected.label : "");
  }, [selected]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const search = (q: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!q || q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q.trim())}`);
        if (!res.ok) throw new Error("Search service unavailable");
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        setResults(json.results || []);
        setOpen(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Geocode lookup failed");
        setResults([]);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 280);
  };

  const handlePick = (item: { name: string; lat: number; lng: number }) => {
    const snapped = onSnap({ lat: item.lat, lng: item.lng });
    if (snapped) {
      onSelect({
        label: item.name.split(",")[0].trim() || item.name,
        coords: { lat: item.lat, lng: item.lng },
        nodeId: snapped.nodeId,
        snapDistance: snapped.snapDistance,
      });
      setOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className="autocomplete-wrapper">
      <div className="input-group">
        <label htmlFor={id} className={`point-badge point-badge-${label.toLowerCase()}`}>
          {label}
        </label>
        <input
          id={id}
          type="text"
          className="search-input"
          value={query}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            search(e.target.value);
          }}
          onFocus={() => {
            if (results.length > 0 || error) setOpen(true);
          }}
        />
        {selected ? (
          <button
            type="button"
            className="input-clear-btn"
            aria-label={`Clear ${label}`}
            onClick={() => {
              setQuery("");
              onClear();
            }}
          >
            <CloseIcon />
          </button>
        ) : null}
      </div>

      {open ? (
        <ul className="autocomplete-dropdown" role="listbox">
          {loading ? <li className="autocomplete-status">Searching...</li> : null}
          {error ? <li className="autocomplete-error">{error}</li> : null}
          {!loading && !error && results.length === 0 ? (
            <li className="autocomplete-status">No matching places found</li>
          ) : null}
          {!loading &&
            results.map((r) => (
              <li
                key={r.placeId}
                role="option"
                aria-selected="false"
                className="autocomplete-item"
                onClick={() => handlePick(r)}
              >
                <div className="autocomplete-icon" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                  </svg>
                </div>
                <div className="autocomplete-text">
                  <div className="item-title">{r.name.split(",")[0]}</div>
                  <div className="item-subtitle">
                    {r.distanceKm !== undefined ? `${r.distanceKm} km • ` : ""}
                    {r.name}
                  </div>
                </div>
              </li>
            ))}
        </ul>
      ) : null}
    </div>
  );
}

export function PointPicker({
  start,
  end,
  onSelectStart,
  onSelectEnd,
  onSwap,
  onSnap,
  disabled,
}: PointPickerProps) {
  const handleLandmark = (landmark: Landmark) => {
    const snapped = onSnap({ lat: landmark.lat, lng: landmark.lng });
    if (!snapped) return;
    const pt: SelectedPoint = {
      label: landmark.name,
      coords: { lat: landmark.lat, lng: landmark.lng },
      nodeId: snapped.nodeId,
      snapDistance: snapped.snapDistance,
    };
    if (!start) {
      onSelectStart(pt);
    } else if (!end) {
      onSelectEnd(pt);
    } else {
      onSelectEnd(pt);
    }
  };

  return (
    <div className="point-picker">
      <div className="directions-box">
        <div className="directions-rail" aria-hidden="true">
          <span className="rail-dot rail-dot-start" />
          <span className="rail-line" />
          <span className="rail-dot rail-dot-end" />
        </div>

        <div className="directions-fields">
          <AutocompleteInput
            id="point-start"
            label="A"
            placeholder="Starting point"
            value={start ? start.label : ""}
            selected={start}
            onSelect={onSelectStart}
            onClear={() => onSelectStart(null)}
            onSnap={onSnap}
            disabled={disabled}
          />
          <AutocompleteInput
            id="point-end"
            label="B"
            placeholder="Destination"
            value={end ? end.label : ""}
            selected={end}
            onSelect={onSelectEnd}
            onClear={() => onSelectEnd(null)}
            onSnap={onSnap}
            disabled={disabled}
          />
        </div>

        <button
          type="button"
          className="swap-btn-floating"
          aria-label="Reverse start and destination"
          title="Reverse start and destination"
          disabled={disabled || (!start && !end)}
          onClick={onSwap}
        >
          <SwapIcon />
        </button>
      </div>

      <div className="landmarks-section">
        <span className="spec-label">Quick Pick</span>
        <div className="landmarks-row">
          {LANDMARKS.map((lm) => {
            const isStart = start?.label === lm.name;
            const isEnd = end?.label === lm.name;
            const isSelected = isStart || isEnd;
            const tooltip = isStart
              ? `${lm.name} is selected as Start (A)`
              : isEnd
              ? `${lm.name} is selected as Destination (B)`
              : !start
              ? `Select ${lm.name} as Starting Point (A)`
              : `Select ${lm.name} as Destination (B)`;

            return (
              <button
                key={lm.id}
                type="button"
                className={`landmark-btn ${isSelected ? "landmark-btn-selected" : ""}`}
                disabled={disabled}
                title={tooltip}
                aria-label={tooltip}
                onClick={() => handleLandmark(lm)}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5-2.5 2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
                <span>{lm.name}</span>
                {isSelected ? (
                  <span className={`landmark-role-chip landmark-role-${isStart ? "a" : "b"}`}>
                    {isStart ? "A" : "B"}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

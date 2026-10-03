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
        <label htmlFor={id} className="point-badge">
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
            <li className="autocomplete-status">No matching places found in or near Jaipur</li>
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
                <div className="item-title">{r.name.split(",")[0]}</div>
                <div className="item-subtitle">
                  {r.distanceKm !== undefined ? `${r.distanceKm} km • ` : ""}
                  {r.name}
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
      <div className="picker-inputs">
        <AutocompleteInput
          id="point-start"
          label="A"
          placeholder="Set start location or click map"
          value={start ? start.label : ""}
          selected={start}
          onSelect={onSelectStart}
          onClear={() => onSelectStart(null)}
          onSnap={onSnap}
          disabled={disabled}
        />
        <div className="swap-row">
          <button
            type="button"
            className="swap-btn"
            aria-label="Swap start and end points"
            disabled={disabled || (!start && !end)}
            onClick={onSwap}
          >
            <SwapIcon />
          </button>
        </div>
        <AutocompleteInput
          id="point-end"
          label="B"
          placeholder="Set destination or click map"
          value={end ? end.label : ""}
          selected={end}
          onSelect={onSelectEnd}
          onClear={() => onSelectEnd(null)}
          onSnap={onSnap}
          disabled={disabled}
        />
      </div>

      <div className="landmarks-section">
        <span className="spec-label">Quick Pick</span>
        <div className="landmarks-row">
          {LANDMARKS.map((lm) => (
            <button
              key={lm.id}
              type="button"
              className="landmark-btn"
              disabled={disabled}
              onClick={() => handleLandmark(lm)}
            >
              {lm.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

import { CITY_SPEED_KMH } from "./graph/geo";

const intFmt = new Intl.NumberFormat("en-US");

export function fmtInt(n: number): string {
  return intFmt.format(Math.round(n));
}

export function fmtKm(meters: number): string {
  if (meters < 0) return "—";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

export function fmtMs(ms: number): string {
  if (ms < 1) return `${ms.toFixed(2)} ms`;
  if (ms < 100) return `${ms.toFixed(1)} ms`;
  return `${Math.round(ms)} ms`;
}

export function driveMinutes(meters: number): number {
  return (meters / 1000 / CITY_SPEED_KMH) * 60;
}

export function fmtDuration(meters: number): string {
  if (meters < 0) return "—";
  const min = driveMinutes(meters);
  if (min < 1) return "under 1 min";
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  return `${h} h ${Math.round(min - h * 60)} min`;
}

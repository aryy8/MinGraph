export interface LngLat {
  lng: number;
  lat: number;
}

/** Graph coverage: regional network bounding box. */
export const DEFAULT_BBOX = { west: 75.50, south: 26.70, east: 76.05, north: 27.10 } as const;
export const DEFAULT_CENTER: LngLat = { lng: 75.78, lat: 26.90 };
export const JAIPUR_BBOX = DEFAULT_BBOX;
export const JAIPUR_CENTER = DEFAULT_CENTER;

export interface Landmark extends LngLat {
  id: string;
  name: string;
}

export const LANDMARKS: readonly Landmark[] = [
  { id: "hawa-mahal", name: "Hawa Mahal", lat: 26.92388, lng: 75.82673 },
  { id: "central-junction", name: "Central Junction", lat: 26.91982, lng: 75.78757 },
  { id: "amer-fort", name: "Amer Fort", lat: 26.98553, lng: 75.85133 },
  { id: "airport", name: "Airport", lat: 26.82418, lng: 75.81215 },
  { id: "manipal-univ", name: "Manipal Univ", lat: 26.8429, lng: 75.5654 },
  { id: "albert-hall", name: "Albert Hall", lat: 26.91164, lng: 75.81954 },
];

const EARTH_RADIUS_M = 6371008.8;
const DEG = Math.PI / 180;

export function haversine(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const dLat = (lat2 - lat1) * DEG;
  const dLng = (lng2 - lng1) * DEG;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function insideBbox(p: LngLat): boolean {
  return p.lng >= DEFAULT_BBOX.west && p.lng <= DEFAULT_BBOX.east && p.lat >= DEFAULT_BBOX.south && p.lat <= DEFAULT_BBOX.north;
}

/** City driving average used for drive time estimates. */
export const CITY_SPEED_KMH = 25;

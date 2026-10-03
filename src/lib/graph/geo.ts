export interface LngLat {
  lng: number;
  lat: number;
}

/** Graph coverage: walled city, Amer to the north, airport and Sitapura to the south. */
export const JAIPUR_BBOX = { west: 75.68, south: 26.78, east: 75.95, north: 27.02 } as const;
export const JAIPUR_CENTER: LngLat = { lng: 75.8, lat: 26.9 };

export interface Landmark extends LngLat {
  id: string;
  name: string;
}

export const LANDMARKS: readonly Landmark[] = [
  { id: "hawa-mahal", name: "Hawa Mahal", lat: 26.92388, lng: 75.82673 },
  { id: "jaipur-junction", name: "Jaipur Junction", lat: 26.91982, lng: 75.78757 },
  { id: "amer-fort", name: "Amer Fort", lat: 26.98553, lng: 75.85133 },
  { id: "jaipur-airport", name: "Jaipur Airport", lat: 26.82418, lng: 75.81215 },
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
  return p.lng >= JAIPUR_BBOX.west && p.lng <= JAIPUR_BBOX.east && p.lat >= JAIPUR_BBOX.south && p.lat <= JAIPUR_BBOX.north;
}

/** City driving average used for drive time estimates. */
export const CITY_SPEED_KMH = 25;

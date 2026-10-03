import { haversine } from "./geo";

/**
 * Uniform grid over node coordinates, stored as two flat arrays
 * (counting sort), for nearest-node snapping.
 */
export class SpatialIndex {
  private readonly cellStart: Int32Array;
  private readonly cellNodes: Int32Array;
  private readonly minLng: number;
  private readonly minLat: number;
  private readonly cols: number;
  private readonly rows: number;
  private readonly cellSize: number;

  constructor(private readonly coords: Float32Array, cellSizeDeg = 0.004) {
    const n = coords.length / 2;
    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;
    for (let i = 0; i < n; i++) {
      const lng = coords[2 * i];
      const lat = coords[2 * i + 1];
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    this.minLng = minLng;
    this.minLat = minLat;
    this.cellSize = cellSizeDeg;
    this.cols = Math.max(1, Math.ceil((maxLng - minLng) / cellSizeDeg) + 1);
    this.rows = Math.max(1, Math.ceil((maxLat - minLat) / cellSizeDeg) + 1);

    const cellOf = new Int32Array(n);
    const counts = new Int32Array(this.cols * this.rows + 1);
    for (let i = 0; i < n; i++) {
      const c = this.cellIndex(coords[2 * i], coords[2 * i + 1]);
      cellOf[i] = c;
      counts[c + 1]++;
    }
    for (let i = 0; i < this.cols * this.rows; i++) counts[i + 1] += counts[i];
    this.cellStart = counts;
    const fill = counts.slice(0, this.cols * this.rows);
    this.cellNodes = new Int32Array(n);
    for (let i = 0; i < n; i++) this.cellNodes[fill[cellOf[i]]++] = i;
  }

  private cellIndex(lng: number, lat: number): number {
    const cx = Math.min(this.cols - 1, Math.max(0, Math.floor((lng - this.minLng) / this.cellSize)));
    const cy = Math.min(this.rows - 1, Math.max(0, Math.floor((lat - this.minLat) / this.cellSize)));
    return cy * this.cols + cx;
  }

  /** Returns the nearest node and its distance in meters, searching outward ring by ring. */
  nearest(lng: number, lat: number, maxRings = 60): { node: number; distance: number } | null {
    const cx = Math.floor((lng - this.minLng) / this.cellSize);
    const cy = Math.floor((lat - this.minLat) / this.cellSize);
    const kx = Math.cos((lat * Math.PI) / 180);
    let best = -1;
    let bestD2 = Infinity;
    for (let ring = 0; ring <= maxRings; ring++) {
      for (let y = cy - ring; y <= cy + ring; y++) {
        if (y < 0 || y >= this.rows) continue;
        const onEdgeRow = y === cy - ring || y === cy + ring;
        for (let x = cx - ring; x <= cx + ring; x++) {
          if (x < 0 || x >= this.cols) continue;
          if (!onEdgeRow && x !== cx - ring && x !== cx + ring) continue;
          const c = y * this.cols + x;
          for (let k = this.cellStart[c]; k < this.cellStart[c + 1]; k++) {
            const i = this.cellNodes[k];
            const dx = (this.coords[2 * i] - lng) * kx;
            const dy = this.coords[2 * i + 1] - lat;
            const d2 = dx * dx + dy * dy;
            if (d2 < bestD2) {
              bestD2 = d2;
              best = i;
            }
          }
        }
      }
      // Any node beyond this ring is at least ring * cellSize away.
      const reach = ring * this.cellSize * Math.min(1, kx);
      if (best >= 0 && reach * reach >= bestD2) break;
    }
    if (best < 0) return null;
    return { node: best, distance: haversine(lng, lat, this.coords[2 * best], this.coords[2 * best + 1]) };
  }
}

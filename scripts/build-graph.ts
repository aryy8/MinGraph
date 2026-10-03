/**
 * Builds the Jaipur drivable road graph from OpenStreetMap (Overpass API)
 * and writes compact binary files to public/data/.
 *
 *   npm run build:graph
 *
 * Output:
 *   nodes.bin    Float32Array  [lon0, lat0, lon1, lat1, ...]   (2n)
 *   offsets.bin  Int32Array    CSR row offsets                  (n + 1)
 *   targets.bin  Int32Array    CSR edge targets                 (m)
 *   weights.bin  Float32Array  haversine edge length in meters  (m)
 *   meta.json    counts, bbox, provenance
 *
 * Raw Overpass responses are cached in scripts/.cache so reruns are offline.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

// Covers greater Jaipur: Bagru and Manipal to the west, Amer and Kukas to the north,
// Airport, Sitapura, and Ring Road to the south, Kanota and Bassi to the east.
const BBOX = { south: 26.70, west: 75.50, north: 27.10, east: 76.05 };
const TILE_ROWS = 3;
const TILE_COLS = 3;

const HIGHWAY_TYPES = [
  "motorway",
  "trunk",
  "primary",
  "secondary",
  "tertiary",
  "unclassified",
  "residential",
  "living_street",
];

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://z.overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

const ROOT = path.resolve(__dirname, "..");
const CACHE_DIR = path.join(ROOT, "scripts", ".cache");
const OUT_DIR = path.join(ROOT, "public", "data");

interface OverpassNode {
  type: "node";
  id: number;
  lat: number;
  lon: number;
}
interface OverpassWay {
  type: "way";
  id: number;
  nodes: number[];
  tags?: Record<string, string>;
}
type OverpassElement = OverpassNode | OverpassWay;
interface OverpassResponse {
  elements: OverpassElement[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function buildQuery(s: number, w: number, n: number, e: number): string {
  const re = `^(${HIGHWAY_TYPES.join("|")})(_link)?$`;
  return `[out:json][timeout:180];
way["highway"~"${re}"]["area"!="yes"]["access"!~"^(private|no)$"]["motor_vehicle"!~"^(private|no)$"](${s},${w},${n},${e});
(._;>;);
out body qt;`;
}

async function fetchTile(index: number, s: number, w: number, n: number, e: number): Promise<OverpassResponse> {
  const cacheFile = path.join(CACHE_DIR, `tile-${index}-${s.toFixed(3)}-${w.toFixed(3)}-${n.toFixed(3)}-${e.toFixed(3)}.json`);
  if (existsSync(cacheFile)) {
    return JSON.parse(await readFile(cacheFile, "utf8")) as OverpassResponse;
  }
  const query = buildQuery(s, w, n, e);
  let lastError: unknown = null;
  for (let attempt = 0; attempt < ENDPOINTS.length * 2; attempt++) {
    const endpoint = ENDPOINTS[attempt % ENDPOINTS.length];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 200_000);
    try {
      process.stdout.write(`  tile ${index + 1}/${TILE_ROWS * TILE_COLS} via ${new URL(endpoint).host} ... `);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "MinGraph/1.0 (graph build script)",
          Accept: "application/json",
        },
        body: "data=" + encodeURIComponent(query),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const json = JSON.parse(text) as OverpassResponse;
      if (!Array.isArray(json.elements)) throw new Error("Malformed response");
      await writeFile(cacheFile, text);
      console.log(`${json.elements.length} elements`);
      return json;
    } catch (err) {
      lastError = err;
      console.log(`failed (${err instanceof Error ? err.message : String(err)})`);
      await sleep(3000 + attempt * 2000);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`Tile ${index} failed on all endpoints: ${String(lastError)}`);
}

const R = 6371008.8;
function haversine(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Returns [forward, backward] permission for a way. */
function directions(tags: Record<string, string>): [boolean, boolean] {
  const oneway = (tags.oneway ?? "").toLowerCase();
  if (oneway === "yes" || oneway === "true" || oneway === "1") return [true, false];
  if (oneway === "-1" || oneway === "reverse") return [false, true];
  if (oneway === "no" || oneway === "false" || oneway === "0") return [true, true];
  const junction = (tags.junction ?? "").toLowerCase();
  if (junction === "roundabout" || junction === "circular") return [true, false];
  if (tags.highway === "motorway") return [true, false];
  return [true, true];
}

/** Iterative Kosaraju. Returns a component id per node and the id of the largest component. */
function largestScc(n: number, off: Int32Array, tgt: Int32Array): { comp: Int32Array; largest: number } {
  // Reverse CSR
  const roff = new Int32Array(n + 1);
  for (let i = 0; i < tgt.length; i++) roff[tgt[i] + 1]++;
  for (let i = 0; i < n; i++) roff[i + 1] += roff[i];
  const rsrc = new Int32Array(tgt.length);
  const fill = roff.slice(0, n);
  for (let u = 0; u < n; u++) {
    for (let e = off[u]; e < off[u + 1]; e++) rsrc[fill[tgt[e]]++] = u;
  }

  // Pass 1: finish order on forward graph
  const visited = new Uint8Array(n);
  const order = new Int32Array(n);
  let orderLen = 0;
  const stackNode = new Int32Array(n);
  const stackEdge = new Int32Array(n);
  for (let s = 0; s < n; s++) {
    if (visited[s]) continue;
    let sp = 0;
    stackNode[0] = s;
    stackEdge[0] = off[s];
    visited[s] = 1;
    while (sp >= 0) {
      const u = stackNode[sp];
      const e = stackEdge[sp];
      if (e < off[u + 1]) {
        stackEdge[sp] = e + 1;
        const v = tgt[e];
        if (!visited[v]) {
          visited[v] = 1;
          sp++;
          stackNode[sp] = v;
          stackEdge[sp] = off[v];
        }
      } else {
        order[orderLen++] = u;
        sp--;
      }
    }
  }

  // Pass 2: reverse graph in reverse finish order
  const comp = new Int32Array(n).fill(-1);
  const sizes: number[] = [];
  const stack = new Int32Array(n);
  for (let i = n - 1; i >= 0; i--) {
    const s = order[i];
    if (comp[s] !== -1) continue;
    const id = sizes.length;
    let size = 0;
    let sp = 0;
    stack[0] = s;
    comp[s] = id;
    while (sp >= 0) {
      const u = stack[sp--];
      size++;
      for (let e = roff[u]; e < roff[u + 1]; e++) {
        const v = rsrc[e];
        if (comp[v] === -1) {
          comp[v] = id;
          stack[++sp] = v;
        }
      }
    }
    sizes.push(size);
  }
  let largest = 0;
  for (let i = 1; i < sizes.length; i++) if (sizes[i] > sizes[largest]) largest = i;
  return { comp, largest };
}

async function main(): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  await mkdir(OUT_DIR, { recursive: true });

  console.log("Fetching Jaipur roads from Overpass");
  const nodeCoords = new Map<number, [number, number]>();
  const ways = new Map<number, OverpassWay>();
  const latStep = (BBOX.north - BBOX.south) / TILE_ROWS;
  const lonStep = (BBOX.east - BBOX.west) / TILE_COLS;
  let index = 0;
  for (let r = 0; r < TILE_ROWS; r++) {
    for (let c = 0; c < TILE_COLS; c++) {
      const s = BBOX.south + r * latStep;
      const w = BBOX.west + c * lonStep;
      const data = await fetchTile(index++, s, w, s + latStep, w + lonStep);
      for (const el of data.elements) {
        if (el.type === "node") nodeCoords.set(el.id, [el.lon, el.lat]);
        else if (el.type === "way" && el.nodes.length > 1) ways.set(el.id, el);
      }
    }
  }
  console.log(`Merged ${ways.size} ways, ${nodeCoords.size} nodes`);

  // Index referenced nodes
  const idToIndex = new Map<number, number>();
  const lonList: number[] = [];
  const latList: number[] = [];
  const indexOf = (osmId: number): number => {
    let i = idToIndex.get(osmId);
    if (i === undefined) {
      const c = nodeCoords.get(osmId);
      if (!c) return -1;
      i = lonList.length;
      idToIndex.set(osmId, i);
      // Round through float32 so weights match the coordinates the client sees.
      lonList.push(Math.fround(c[0]));
      latList.push(Math.fround(c[1]));
    }
    return i;
  };

  const eu: number[] = [];
  const ev: number[] = [];
  for (const way of ways.values()) {
    const tags = way.tags ?? {};
    const [fwd, bwd] = directions(tags);
    for (let k = 0; k + 1 < way.nodes.length; k++) {
      const a = indexOf(way.nodes[k]);
      const b = indexOf(way.nodes[k + 1]);
      if (a < 0 || b < 0 || a === b) continue;
      if (fwd) {
        eu.push(a);
        ev.push(b);
      }
      if (bwd) {
        eu.push(b);
        ev.push(a);
      }
    }
  }
  const n0 = lonList.length;
  console.log(`Raw graph: ${n0} nodes, ${eu.length} directed edges`);

  // Sort + dedupe edges into CSR
  const order = Array.from({ length: eu.length }, (_, i) => i);
  order.sort((x, y) => eu[x] - eu[y] || ev[x] - ev[y]);
  const off0 = new Int32Array(n0 + 1);
  const tgt0: number[] = [];
  let prevU = -1;
  let prevV = -1;
  const src0: number[] = [];
  for (const i of order) {
    if (eu[i] === prevU && ev[i] === prevV) continue;
    prevU = eu[i];
    prevV = ev[i];
    src0.push(prevU);
    tgt0.push(prevV);
  }
  for (const u of src0) off0[u + 1]++;
  for (let i = 0; i < n0; i++) off0[i + 1] += off0[i];
  const tgt0Arr = Int32Array.from(tgt0);

  // Largest strongly connected component
  const { comp, largest } = largestScc(n0, off0, tgt0Arr);

  // Reindex kept nodes in Morton (Z-order) for memory locality
  const kept: number[] = [];
  for (let i = 0; i < n0; i++) if (comp[i] === largest) kept.push(i);
  const morton = (lon: number, lat: number): number => {
    const x = Math.floor(((lon - BBOX.west) / (BBOX.east - BBOX.west)) * 65535);
    const y = Math.floor(((lat - BBOX.south) / (BBOX.north - BBOX.south)) * 65535);
    let z = 0;
    for (let b = 15; b >= 0; b--) z = z * 4 + (((y >> b) & 1) << 1) + ((x >> b) & 1);
    return z;
  };
  const keys = new Map<number, number>();
  for (const i of kept) keys.set(i, morton(lonList[i], latList[i]));
  kept.sort((a, b) => (keys.get(a) ?? 0) - (keys.get(b) ?? 0));
  const newIndex = new Int32Array(n0).fill(-1);
  kept.forEach((old, i) => (newIndex[old] = i));

  const n = kept.length;
  const coords = new Float32Array(2 * n);
  const offsets = new Int32Array(n + 1);
  const targetsList: number[] = [];
  const weightsList: number[] = [];
  for (let i = 0; i < n; i++) {
    const old = kept[i];
    coords[2 * i] = lonList[old];
    coords[2 * i + 1] = latList[old];
    const row: Array<[number, number]> = [];
    for (let e = off0[old]; e < off0[old + 1]; e++) {
      const v = newIndex[tgt0Arr[e]];
      if (v < 0) continue;
      const w = haversine(lonList[old], latList[old], lonList[tgt0Arr[e]], latList[tgt0Arr[e]]);
      row.push([v, w]);
    }
    row.sort((a, b) => a[0] - b[0]);
    for (const [v, w] of row) {
      targetsList.push(v);
      weightsList.push(w);
    }
    offsets[i + 1] = targetsList.length;
  }
  const targets = Int32Array.from(targetsList);
  const weights = Float32Array.from(weightsList);
  const m = targets.length;
  console.log(`Largest SCC: ${n} nodes, ${m} directed edges (${((n / n0) * 100).toFixed(1)}% of nodes kept)`);

  const write = (name: string, arr: ArrayBufferView): Promise<void> =>
    writeFile(path.join(OUT_DIR, name), Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength));
  await write("nodes.bin", coords);
  await write("offsets.bin", offsets);
  await write("targets.bin", targets);
  await write("weights.bin", weights);

  let totalLength = 0;
  for (let i = 0; i < m; i++) totalLength += weights[i];
  const meta = {
    name: "Jaipur",
    nodes: n,
    edges: m,
    bbox: [BBOX.west, BBOX.south, BBOX.east, BBOX.north],
    totalEdgeLengthKm: Math.round(totalLength / 100) / 10,
    highwayTypes: HIGHWAY_TYPES.flatMap((t) => [t, `${t}_link`]),
    generatedAt: new Date().toISOString(),
    source: "OpenStreetMap contributors, via the Overpass API (ODbL)",
    files: {
      nodes: "nodes.bin",
      offsets: "offsets.bin",
      targets: "targets.bin",
      weights: "weights.bin",
    },
  };
  await writeFile(path.join(OUT_DIR, "meta.json"), JSON.stringify(meta, null, 2) + "\n");
  console.log(`Wrote public/data (${((coords.byteLength + offsets.byteLength + targets.byteLength + weights.byteLength) / 1e6).toFixed(1)} MB)`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});

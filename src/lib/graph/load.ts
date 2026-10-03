export interface GraphMeta {
  name: string;
  nodes: number;
  edges: number;
  bbox: [number, number, number, number];
  totalEdgeLengthKm: number;
  generatedAt: string;
  source: string;
}

/** CSR road graph as loaded from public/data. */
export interface RoadGraph {
  meta: GraphMeta;
  n: number;
  m: number;
  /** lon, lat interleaved (2n) */
  coords: Float32Array;
  /** CSR offsets (n + 1) */
  offsets: Int32Array;
  /** CSR targets (m) */
  targets: Int32Array;
  /** edge lengths in meters (m) */
  weights: Float32Array;
}

async function fetchBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Could not load ${url} (HTTP ${res.status})`);
  return res.arrayBuffer();
}

let cached: Promise<RoadGraph> | null = null;

/** Loads the precomputed graph once per page. */
export function loadGraph(base = "/data"): Promise<RoadGraph> {
  if (cached) return cached;
  cached = (async () => {
    const metaRes = await fetch(`${base}/meta.json?t=${Date.now()}`, { cache: "no-cache" });
    if (!metaRes.ok) throw new Error("Road network metadata is missing");
    const meta = (await metaRes.json()) as GraphMeta;
    const v = encodeURIComponent(meta.generatedAt);
    const [nodes, offsets, targets, weights] = await Promise.all([
      fetchBuffer(`${base}/nodes.bin?v=${v}`),
      fetchBuffer(`${base}/offsets.bin?v=${v}`),
      fetchBuffer(`${base}/targets.bin?v=${v}`),
      fetchBuffer(`${base}/weights.bin?v=${v}`),
    ]);
    const graph: RoadGraph = {
      meta,
      n: meta.nodes,
      m: meta.edges,
      coords: new Float32Array(nodes),
      offsets: new Int32Array(offsets),
      targets: new Int32Array(targets),
      weights: new Float32Array(weights),
    };
    if (graph.coords.length !== 2 * graph.n || graph.offsets.length !== graph.n + 1 || graph.targets.length !== graph.m) {
      throw new Error("Road network files are inconsistent");
    }
    return graph;
  })();
  cached.catch(() => {
    cached = null;
  });
  return cached;
}

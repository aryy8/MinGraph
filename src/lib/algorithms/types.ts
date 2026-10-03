export type AlgorithmId = "dijkstra" | "astar" | "bfs" | "bidirectional";

export interface AlgorithmInfo {
  id: AlgorithmId;
  /** Numeric id understood by the C++ solver (see native/mingraph.hpp). */
  code: number;
  name: string;
  short: string;
  /** Number of search roots, used to convert steps to nodes visited. */
  roots: number;
}

export const ALGORITHMS: readonly AlgorithmInfo[] = [
  { id: "dijkstra", code: 0, name: "Dijkstra", short: "Dijkstra", roots: 1 },
  { id: "astar", code: 1, name: "A*", short: "A*", roots: 1 },
  { id: "bfs", code: 2, name: "BFS", short: "BFS", roots: 1 },
  { id: "bidirectional", code: 3, name: "Bidirectional Dijkstra", short: "Bidir.", roots: 2 },
];

export const ALGORITHM_IDS: readonly AlgorithmId[] = ALGORITHMS.map((a) => a.id);

export function algorithmInfo(id: AlgorithmId): AlgorithmInfo {
  const info = ALGORITHMS.find((a) => a.id === id);
  if (!info) throw new Error(`Unknown algorithm ${id}`);
  return info;
}

/** A recorded search, ready for replay. Produced only by the worker. */
export interface RunResult {
  algorithm: AlgorithmId;
  found: boolean;
  /** Number of explored edges (timeline steps). */
  steps: number;
  /** Explored edge segments in visit order: [lng0, lat0, lng1, lat1] per step. */
  segments: Float32Array;
  /** Frontier size after each step. */
  frontier: Int32Array;
  /** Cumulative explored length in meters after each step. */
  exploredLength: Float32Array;
  /** Node ids on the final path, source to target. */
  path: Int32Array;
  /** [lng, lat] per path node. */
  pathCoords: Float32Array;
  /** Path length in meters, or -1. */
  distance: number;
  nodesVisited: number;
  edgesRelaxed: number;
  /** Time measured inside the C++ solver. */
  computeMs: number;
}

export type WorkerRequest =
  | {
      type: "init";
      wasmUrl: string;
      coords: Float32Array;
      offsets: Int32Array;
      targets: Int32Array;
      weights: Float32Array;
    }
  | { type: "run"; id: number; algorithm: AlgorithmId; src: number; dst: number };

export type WorkerResponse =
  | { type: "ready" }
  | { type: "result"; id: number; result: RunResult }
  | { type: "error"; id: number | null; message: string };

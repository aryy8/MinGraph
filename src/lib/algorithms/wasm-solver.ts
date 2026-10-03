/**
 * Thin typed wrapper around the Emscripten module in public/wasm.
 * Shared by the Web Worker and the Node test script.
 */
import type { AlgorithmId, RunResult } from "./types";
import { algorithmInfo } from "./types";

export interface MinGraphModule {
  HEAPU8: Uint8Array;
  HEAP32: Int32Array;
  HEAPF32: Float32Array;
  _malloc(bytes: number): number;
  _free(ptr: number): void;
  cwrap(name: string, returnType: "number" | null, argTypes: Array<"number">): (...args: number[]) => number;
}

export type MinGraphFactory = (options?: { locateFile?: (file: string) => string }) => Promise<MinGraphModule>;

export interface GraphArrays {
  coords: Float32Array;
  offsets: Int32Array;
  targets: Int32Array;
  weights: Float32Array;
}

export class WasmSolver {
  private readonly runFn: (algo: number, src: number, dst: number) => number;
  private readonly getters: Record<
    | "exploredPtr"
    | "exploredLen"
    | "frontierPtr"
    | "frontierLen"
    | "pathPtr"
    | "pathLen"
    | "distance"
    | "nodesVisited"
    | "edgesRelaxed"
    | "computeMs",
    () => number
  >;
  private readonly coords: Float32Array;

  constructor(private readonly mod: MinGraphModule, graph: GraphArrays) {
    const n = graph.offsets.length - 1;
    const m = graph.targets.length;
    // Copy the graph into the WASM heap once. C++ keeps these pointers.
    const copy = (src: Float32Array | Int32Array): number => {
      const ptr = mod._malloc(src.byteLength);
      mod.HEAPU8.set(new Uint8Array(src.buffer, src.byteOffset, src.byteLength), ptr);
      return ptr;
    };
    const pc = copy(graph.coords);
    const po = copy(graph.offsets);
    const pt = copy(graph.targets);
    const pw = copy(graph.weights);
    const load = mod.cwrap("mg_load", "number", ["number", "number", "number", "number", "number", "number"]);
    load(pc, po, pt, pw, n, m);
    this.coords = graph.coords;

    this.runFn = mod.cwrap("mg_run", "number", ["number", "number", "number"]);
    const g = (name: string) => mod.cwrap(name, "number", []);
    this.getters = {
      exploredPtr: g("mg_explored_ptr"),
      exploredLen: g("mg_explored_len"),
      frontierPtr: g("mg_frontier_ptr"),
      frontierLen: g("mg_frontier_len"),
      pathPtr: g("mg_path_ptr"),
      pathLen: g("mg_path_len"),
      distance: g("mg_distance"),
      nodesVisited: g("mg_nodes_visited"),
      edgesRelaxed: g("mg_edges_relaxed"),
      computeMs: g("mg_compute_ms"),
    };
  }

  /** Copies an int32 buffer out of WASM memory (re-reading HEAP32, which changes on growth). */
  private readInt32(ptr: number, len: number): Int32Array {
    if (len === 0) return new Int32Array(0);
    return this.mod.HEAP32.slice(ptr >> 2, (ptr >> 2) + len);
  }

  run(algorithm: AlgorithmId, src: number, dst: number): RunResult {
    const status = this.runFn(algorithmInfo(algorithm).code, src, dst);
    if (status < 0) throw new Error("Solver is not initialised");
    const g = this.getters;
    const explored = this.readInt32(g.exploredPtr(), g.exploredLen());
    const frontier = this.readInt32(g.frontierPtr(), g.frontierLen());
    const path = this.readInt32(g.pathPtr(), g.pathLen());
    const steps = explored.length / 2;

    const c = this.coords;
    const segments = new Float32Array(steps * 4);
    const exploredLength = new Float32Array(steps);
    let acc = 0;
    for (let i = 0; i < steps; i++) {
      const a = explored[2 * i];
      const b = explored[2 * i + 1];
      const x0 = c[2 * a];
      const y0 = c[2 * a + 1];
      const x1 = c[2 * b];
      const y1 = c[2 * b + 1];
      segments[4 * i] = x0;
      segments[4 * i + 1] = y0;
      segments[4 * i + 2] = x1;
      segments[4 * i + 3] = y1;
      // Equirectangular is accurate to well under 0.1% at this scale.
      const dx = (x1 - x0) * Math.cos(((y0 + y1) * Math.PI) / 360);
      const dy = y1 - y0;
      acc += Math.sqrt(dx * dx + dy * dy) * 111194.93;
      exploredLength[i] = acc;
    }
    const pathCoords = new Float32Array(path.length * 2);
    for (let i = 0; i < path.length; i++) {
      pathCoords[2 * i] = c[2 * path[i]];
      pathCoords[2 * i + 1] = c[2 * path[i] + 1];
    }
    const found = status === 1;
    return {
      algorithm,
      found,
      steps,
      segments,
      frontier,
      exploredLength,
      path,
      pathCoords,
      distance: found ? g.distance() : -1,
      nodesVisited: g.nodesVisited(),
      edgesRelaxed: g.edgesRelaxed(),
      computeMs: g.computeMs(),
    };
  }
}

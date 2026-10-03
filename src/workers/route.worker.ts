/// <reference lib="webworker" />
/**
 * Route worker: owns one WASM solver instance. The main thread never runs
 * search code; it only sends (algorithm, src, dst) and replays the trace.
 */
import type { RunResult, WorkerRequest, WorkerResponse } from "../lib/algorithms/types";
import { WasmSolver, type MinGraphFactory } from "../lib/algorithms/wasm-solver";

declare const self: DedicatedWorkerGlobalScope;

let solver: WasmSolver | null = null;

function post(msg: WorkerResponse, transfer: Transferable[] = []): void {
  self.postMessage(msg, transfer);
}

async function init(req: Extract<WorkerRequest, { type: "init" }>): Promise<void> {
  // Loaded at runtime from /public so the bundler never touches the Emscripten glue.
  const glue = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ req.wasmUrl)) as {
    default: MinGraphFactory;
  };
  const mod = await glue.default();
  solver = new WasmSolver(mod, req);
  post({ type: "ready" });
}

function transferables(r: RunResult): Transferable[] {
  return [r.segments.buffer, r.frontier.buffer, r.exploredLength.buffer, r.path.buffer, r.pathCoords.buffer] as ArrayBuffer[];
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  if (req.type === "init") {
    init(req).catch((err: unknown) => {
      post({ type: "error", id: null, message: err instanceof Error ? err.message : String(err) });
    });
    return;
  }
  if (req.type === "run") {
    try {
      if (!solver) throw new Error("Solver not ready");
      const result = solver.run(req.algorithm, req.src, req.dst);
      post({ type: "result", id: req.id, result }, transferables(result));
    } catch (err) {
      post({ type: "error", id: req.id, message: err instanceof Error ? err.message : String(err) });
    }
  }
};

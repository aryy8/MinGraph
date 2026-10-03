/**
 * Lazily spawns one worker per algorithm so Compare can run all four in
 * parallel. Each worker gets its own copy of the graph once.
 */
import type { RoadGraph } from "../graph/load";
import type { AlgorithmId, RunResult, WorkerRequest, WorkerResponse } from "./types";

interface Pending {
  resolve: (r: RunResult) => void;
  reject: (e: Error) => void;
}

class RouteWorker {
  private readonly worker: Worker;
  private readonly ready: Promise<void>;
  private readonly pending = new Map<number, Pending>();
  private nextId = 1;

  constructor(graph: RoadGraph) {
    this.worker = new Worker(new URL("../../workers/route.worker.ts", import.meta.url), { type: "module" });
    this.ready = new Promise<void>((resolve, reject) => {
      this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const msg = event.data;
        if (msg.type === "ready") {
          resolve();
        } else if (msg.type === "result") {
          this.pending.get(msg.id)?.resolve(msg.result);
          this.pending.delete(msg.id);
        } else if (msg.type === "error") {
          if (msg.id === null) {
            reject(new Error(msg.message));
          } else {
            this.pending.get(msg.id)?.reject(new Error(msg.message));
            this.pending.delete(msg.id);
          }
        }
      };
      this.worker.onerror = (event) => {
        const err = new Error(event.message || "Route worker failed to start");
        reject(err);
        for (const p of this.pending.values()) p.reject(err);
        this.pending.clear();
      };
    });
    const wasmUrl = new URL("/wasm/mingraph.js", window.location.origin).href;
    const init: WorkerRequest = {
      type: "init",
      wasmUrl,
      coords: graph.coords,
      offsets: graph.offsets,
      targets: graph.targets,
      weights: graph.weights,
    };
    this.worker.postMessage(init);
  }

  async run(algorithm: AlgorithmId, src: number, dst: number): Promise<RunResult> {
    await this.ready;
    const id = this.nextId++;
    return new Promise<RunResult>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const req: WorkerRequest = { type: "run", id, algorithm, src, dst };
      this.worker.postMessage(req);
    });
  }
}

const workers = new Map<AlgorithmId, RouteWorker>();

export function runAlgorithm(graph: RoadGraph, algorithm: AlgorithmId, src: number, dst: number): Promise<RunResult> {
  let w = workers.get(algorithm);
  if (!w) {
    w = new RouteWorker(graph);
    workers.set(algorithm, w);
  }
  return w.run(algorithm, src, dst);
}

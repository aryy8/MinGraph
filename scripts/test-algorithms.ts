/**
 * Quick agreement test against the compiled WASM module (the same binary the
 * browser runs): Dijkstra, A* and Bidirectional Dijkstra must return the same
 * distance on 20 random Jaipur pairs.
 *
 *   npm test
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { WasmSolver, type MinGraphFactory } from "../src/lib/algorithms/wasm-solver";

const ROOT = path.resolve(__dirname, "..");

async function readTyped<T extends Float32Array | Int32Array>(file: string, Ctor: new (b: ArrayBuffer) => T): Promise<T> {
  const buf = await readFile(path.join(ROOT, "public", "data", file));
  const copy = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  return new Ctor(copy);
}

// Small deterministic PRNG so failures are reproducible.
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function main(): Promise<void> {
  const coords = await readTyped("nodes.bin", Float32Array);
  const offsets = await readTyped("offsets.bin", Int32Array);
  const targets = await readTyped("targets.bin", Int32Array);
  const weights = await readTyped("weights.bin", Float32Array);
  const n = offsets.length - 1;

  const glueUrl = pathToFileURL(path.join(ROOT, "public", "wasm", "mingraph.js")).href;
  const glue = (await import(glueUrl)) as { default: MinGraphFactory };
  const mod = await glue.default();
  const solver = new WasmSolver(mod, { coords, offsets, targets, weights });
  console.log(`Graph: ${n} nodes, ${targets.length} edges`);

  const rand = mulberry32(7);
  let failures = 0;
  for (let i = 0; i < 20; i++) {
    const s = Math.floor(rand() * n);
    const t = Math.floor(rand() * n);
    const dj = solver.run("dijkstra", s, t);
    const as = solver.run("astar", s, t);
    const bi = solver.run("bidirectional", s, t);
    const tol = 1e-6 * dj.distance + 1e-3;
    const ok = dj.found && as.found && bi.found && Math.abs(dj.distance - as.distance) <= tol && Math.abs(dj.distance - bi.distance) <= tol;
    if (!ok) failures++;
    console.log(
      `${String(i + 1).padStart(2)}  ${String(s).padStart(6)} -> ${String(t).padStart(6)}  ` +
        `dijkstra ${dj.distance.toFixed(2).padStart(10)} m  a* ${as.distance.toFixed(2).padStart(10)} m  ` +
        `bidir ${bi.distance.toFixed(2).padStart(10)} m  ${ok ? "ok" : "MISMATCH"}`,
    );
  }
  if (failures > 0) {
    console.error(`${failures} of 20 pairs disagree`);
    process.exit(1);
  }
  console.log("All 20 pairs agree");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});

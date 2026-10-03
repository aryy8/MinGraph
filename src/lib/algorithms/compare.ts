import { algorithmInfo, type AlgorithmId, type RunResult } from "./types";

export interface CompareRow {
  id: AlgorithmId;
  name: string;
  nodesVisited: number;
  edgesRelaxed: number;
  distance: number;
  computeMs: number;
  optimal: boolean;
}

export interface CompareSummary {
  rows: CompareRow[];
  optimalDistance: number;
  best: {
    nodesVisited: number;
    edgesRelaxed: number;
    distance: number;
    computeMs: number;
  };
}

/** Distances within this many meters (or relative 1e-6) are treated as equal. */
function same(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(0.01, 1e-6 * Math.max(a, b));
}

export function summarize(results: RunResult[]): CompareSummary {
  const found = results.filter((r) => r.found);
  const optimalDistance = found.length ? Math.min(...found.map((r) => r.distance)) : -1;
  const rows: CompareRow[] = results.map((r) => ({
    id: r.algorithm,
    name: algorithmInfo(r.algorithm).name,
    nodesVisited: r.nodesVisited,
    edgesRelaxed: r.edgesRelaxed,
    distance: r.distance,
    computeMs: r.computeMs,
    optimal: r.found && same(r.distance, optimalDistance),
  }));
  const min = (f: (r: CompareRow) => number) => Math.min(...rows.map(f));
  return {
    rows,
    optimalDistance,
    best: {
      nodesVisited: min((r) => r.nodesVisited),
      edgesRelaxed: min((r) => r.edgesRelaxed),
      distance: optimalDistance,
      computeMs: min((r) => r.computeMs),
    },
  };
}

export function isBest(value: number, best: number, kind: "count" | "distance" | "time"): boolean {
  if (kind === "distance") return value >= 0 && same(value, best);
  if (kind === "time") return Math.abs(value - best) < 0.005;
  return value === best;
}

const fmt = new Intl.NumberFormat("en-US");

/** One plain sentence drawn from the measured numbers. */
export function insight(summary: CompareSummary): string {
  const rows = summary.rows;
  const dijkstra = rows.find((r) => r.id === "dijkstra");
  const optimal = rows.filter((r) => r.optimal).sort((a, b) => a.nodesVisited - b.nodesVisited);
  if (!dijkstra || optimal.length === 0) return "No route was found between these points.";
  const leader = optimal[0];
  const bfs = rows.find((r) => r.id === "bfs");
  if (leader.id !== "dijkstra" && leader.nodesVisited < dijkstra.nodesVisited) {
    const pct = Math.round((1 - leader.nodesVisited / dijkstra.nodesVisited) * 100);
    let sentence = `${leader.name} visited ${pct}% fewer nodes than Dijkstra on the same route (${fmt.format(leader.nodesVisited)} against ${fmt.format(dijkstra.nodesVisited)})`;
    if (bfs && !bfs.optimal && bfs.distance > 0) {
      const longer = ((bfs.distance / summary.optimalDistance - 1) * 100).toFixed(1);
      sentence += `, while BFS returned a route ${longer}% longer because it counts turns, not meters`;
    }
    return sentence + ".";
  }
  return `Dijkstra visited the fewest nodes of the optimal algorithms on this route (${fmt.format(dijkstra.nodesVisited)}).`;
}

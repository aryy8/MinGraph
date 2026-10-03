"use client";

import { algorithmInfo, type RunResult } from "../lib/algorithms/types";
import { fmtInt, fmtKm } from "../lib/format";
import type { Playback } from "../lib/playback";
import type { Hue } from "./trace-layers";
import { usePlayback } from "./usePlayback";

export interface StatColumn {
  result: RunResult;
  hue?: Hue;
}

function liveValues(result: RunResult, pb: Playback) {
  const drawn = pb.explored(result.steps);
  const roots = algorithmInfo(result.algorithm).roots;
  const started = pb.t > 0;
  const visited = drawn >= result.steps ? result.nodesVisited : started ? Math.min(result.nodesVisited, drawn + roots) : 0;
  const frontier = drawn > 0 ? result.frontier[drawn - 1] : started ? roots : 0;
  const explored = drawn > 0 ? result.exploredLength[drawn - 1] : 0;
  return { visited, frontier, explored };
}

/** Live counters that follow the playback clock. */
export function LiveStats({ columns, playback }: { columns: StatColumn[]; playback: Playback }) {
  const pb = usePlayback(playback);
  const values = columns.map((c) => liveValues(c.result, pb));
  const single = columns.length === 1;
  const rows: Array<{ label: string; get: (i: number) => string }> = [
    { label: "Nodes visited", get: (i) => fmtInt(values[i].visited) },
    { label: "Frontier size", get: (i) => fmtInt(values[i].frontier) },
    { label: "Distance explored", get: (i) => fmtKm(values[i].explored) },
  ];
  return (
    <table className="spec-table" aria-live="off">
      {!single ? (
        <thead>
          <tr>
            <th scope="col" className="spec-label">
              <span className="sr-only">Measure</span>
            </th>
            {columns.map((c) => (
              <th key={c.result.algorithm} scope="col" className="spec-label num">
                {c.hue ? <span className={`swatch swatch-${c.hue}`} aria-hidden /> : null}
                {algorithmInfo(c.result.algorithm).short}
              </th>
            ))}
          </tr>
        </thead>
      ) : null}
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <th scope="row" className="spec-label">
              {r.label}
            </th>
            {columns.map((c, i) => (
              <td key={c.result.algorithm} className="num">
                {r.get(i)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

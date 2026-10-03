"use client";

import { useMemo } from "react";
import type { RunResult, AlgorithmId } from "../lib/algorithms/types";
import { summarize, isBest, insight, type CompareSummary } from "../lib/algorithms/compare";
import { fmtInt, fmtKm, fmtMs } from "../lib/format";

interface CompareResultsProps {
  results: RunResult[];
  compareAlgos: [AlgorithmId, AlgorithmId];
}

export function CompareResults({ results, compareAlgos }: CompareResultsProps) {
  const summary: CompareSummary = useMemo(() => summarize(results), [results]);
  const insightText = useMemo(() => insight(summary), [summary]);

  const maxVisited = Math.max(...summary.rows.map((r) => r.nodesVisited), 1);

  // Colors according to spec: algorithm A uses ink-blue (#1F4E79), algorithm B uses terracotta (#C2410C), others neutral ink (#64748B)
  const barColor = (id: AlgorithmId) => {
    if (id === compareAlgos[0]) return "#1F4E79";
    if (id === compareAlgos[1]) return "#C2410C";
    return "#78716C";
  };

  return (
    <div className="compare-section">
      <div className="section-header">
        <span className="spec-label">Algorithm Comparison</span>
      </div>

      <div className="table-wrapper">
        <table className="compare-table">
          <thead>
            <tr>
              <th scope="col" className="th-algo">Algorithm</th>
              <th scope="col" className="th-complexity">Time Complx</th>
              <th scope="col" className="th-num">Visited</th>
              <th scope="col" className="th-num">Relaxed</th>
              <th scope="col" className="th-num">Distance</th>
              <th scope="col" className="th-num">Compute</th>
              <th scope="col" className="th-center">Optimal</th>
            </tr>
          </thead>
          <tbody>
            {summary.rows.map((row) => {
              const bestVisited = isBest(row.nodesVisited, summary.best.nodesVisited, "count");
              const bestRelaxed = isBest(row.edgesRelaxed, summary.best.edgesRelaxed, "count");
              const bestDist = isBest(row.distance, summary.best.distance, "distance");
              const bestTime = isBest(row.computeMs, summary.best.computeMs, "time");

              return (
                <tr key={row.id}>
                  <td className="col-algo">
                    <span
                      className="swatch"
                      style={{ backgroundColor: barColor(row.id) }}
                      aria-hidden
                    />
                    <span className="algo-name">{row.name}</span>
                  </td>
                  <td className="col-complexity">
                    <code className="complexity-badge">{row.timeComplexity}</code>
                  </td>
                  <td className={`num ${bestVisited ? "cell-best" : ""}`}>
                    {fmtInt(row.nodesVisited)}
                  </td>
                  <td className={`num ${bestRelaxed ? "cell-best" : ""}`}>
                    {fmtInt(row.edgesRelaxed)}
                  </td>
                  <td className={`num ${bestDist ? "cell-best" : ""}`}>
                    {row.distance >= 0 ? fmtKm(row.distance) : "No path"}
                  </td>
                  <td className={`num ${bestTime ? "cell-best" : ""}`}>
                    {fmtMs(row.computeMs)}
                  </td>
                  <td className="cell-optimal">
                    {row.optimal ? (
                      <span className="optimal-yes">Yes</span>
                    ) : (
                      <span className="optimal-no">No</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="complexity-section">
        <span className="spec-label">Theoretical Complexity</span>
        <div className="complexity-grid">
          {summary.rows.map((row) => (
            <div key={`comp-${row.id}`} className="complexity-card">
              <div className="complexity-header">
                <span
                  className="swatch"
                  style={{ backgroundColor: barColor(row.id) }}
                  aria-hidden
                />
                <span className="complexity-name">{row.name}</span>
                <code className="complexity-pill">{row.timeComplexity}</code>
              </div>
              <p className="complexity-desc">
                <span className="complexity-space">Space: <code>{row.spaceComplexity}</code></span>
                {" • "}
                {row.complexityNote}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="chart-section">
        <span className="spec-label">Nodes Visited</span>
        <svg
          className="bar-chart"
          viewBox={`0 0 320 ${summary.rows.length * 28 + 10}`}
          preserveAspectRatio="none"
          role="img"
          aria-label="Bar chart comparing nodes visited per algorithm"
        >
          {summary.rows.map((row, idx) => {
            const y = idx * 28 + 12;
            const barWidth = Math.max(2, (row.nodesVisited / maxVisited) * 190);
            const color = barColor(row.id);

            return (
              <g key={row.id} className="bar-group">
                <text
                  x="0"
                  y={y + 11}
                  className="bar-label"
                  fill="#1C1B19"
                  fontSize="11"
                  fontFamily="var(--font-geist-sans), sans-serif"
                >
                  {row.id === "bidirectional" ? "Bidir." : row.name}
                </text>
                <rect
                  x="68"
                  y={y}
                  width={barWidth}
                  height="14"
                  fill={color}
                  rx="1"
                />
                <text
                  x={74 + barWidth}
                  y={y + 11}
                  className="bar-value"
                  fill="#1C1B19"
                  fontSize="10"
                  fontFamily="var(--font-geist-mono), monospace"
                >
                  {fmtInt(row.nodesVisited)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="insight-box">
        <p className="insight-text">{insightText}</p>
      </div>
    </div>
  );
}

/**
 * Turns a RunResult into GPU-ready binary layer data once, then produces
 * cheap layer descriptors per frame. Per-frame work is limited to changing
 * DataFilterExtension ranges (uniforms); buffers are never rebuilt.
 */
import type { Layer } from "@deck.gl/core";
import { DataFilterExtension } from "@deck.gl/extensions";
import { LineLayer, ScatterplotLayer } from "@deck.gl/layers";
import type { RunResult } from "../lib/algorithms/types";

export type Hue = "blue" | "terra";

type RGB = [number, number, number];

interface Palette {
  pale: RGB;
  deep: RGB;
  frontier: RGB;
  route: RGB;
}

export const PALETTES: Record<Hue, Palette> = {
  // Single-hue ink-blue ramp, pale to deep, ordered by exploration time.
  blue: { pale: [200, 213, 226], deep: [31, 78, 121], frontier: [14, 40, 66], route: [194, 65, 12] },
  terra: { pale: [240, 210, 192], deep: [194, 65, 12], frontier: [110, 36, 6], route: [194, 65, 12] },
};

export const SATELLITE_PALETTES: Record<Hue, Palette> = {
  // Vibrant luminous ramps that pop with high contrast against dark photographic satellite terrain.
  blue: { pale: [147, 197, 253], deep: [59, 130, 246], frontier: [96, 165, 250], route: [249, 115, 22] },
  terra: { pale: [254, 215, 170], deep: [249, 115, 22], frontier: [251, 146, 60], route: [249, 115, 22] },
};

const PAPER: [number, number, number, number] = [255, 255, 255, 255];

const FILTER = new DataFilterExtension({ filterSize: 1 });

interface BinaryLineData {
  length: number;
  attributes: {
    getSourcePosition: { value: Float32Array; size: 2; stride: number; offset: number };
    getTargetPosition: { value: Float32Array; size: 2; stride: number; offset: number };
    getFilterValue: { value: Float32Array; size: 1 };
    getColor?: { value: Uint8Array; size: 4 };
  };
}

interface BinaryPointData {
  length: number;
  attributes: {
    getPosition: { value: Float32Array; size: 2 };
    getFilterValue: { value: Float32Array; size: 1 };
  };
}

export interface PreparedTrace {
  steps: number;
  routeSegments: number;
  hue: Hue;
  explored: BinaryLineData;
  frontier: BinaryLineData;
  route: BinaryLineData;
  joints: BinaryPointData;
  key: string;
}

let serial = 0;

export function prepareTrace(result: RunResult, hue: Hue, isSatellite = false): PreparedTrace {
  const steps = result.steps;
  const palette = isSatellite ? SATELLITE_PALETTES[hue] : PALETTES[hue];
  const index = new Float32Array(steps);
  const colors = new Uint8Array(steps * 4);
  const [pr, pg, pb] = palette.pale;
  const [dr, dg, db] = palette.deep;
  for (let i = 0; i < steps; i++) {
    index[i] = i;
    // Slight ease so the early part of the search does not wash out.
    const f = steps > 1 ? Math.pow(i / (steps - 1), 0.8) : 1;
    colors[4 * i] = pr + (dr - pr) * f;
    colors[4 * i + 1] = pg + (dg - pg) * f;
    colors[4 * i + 2] = pb + (db - pb) * f;
    colors[4 * i + 3] = isSatellite ? 245 : 235;
  }
  const seg = result.segments;
  const explored: BinaryLineData = {
    length: steps,
    attributes: {
      getSourcePosition: { value: seg, size: 2, stride: 16, offset: 0 },
      getTargetPosition: { value: seg, size: 2, stride: 16, offset: 8 },
      getFilterValue: { value: index, size: 1 },
      getColor: { value: colors, size: 4 },
    },
  };
  const frontier: BinaryLineData = {
    length: steps,
    attributes: {
      getSourcePosition: { value: seg, size: 2, stride: 16, offset: 0 },
      getTargetPosition: { value: seg, size: 2, stride: 16, offset: 8 },
      getFilterValue: { value: index, size: 1 },
    },
  };

  const pc = result.pathCoords;
  const points = pc.length / 2;
  const routeSegments = Math.max(0, points - 1);
  const routeSeg = new Float32Array(routeSegments * 4);
  const routeIdx = new Float32Array(routeSegments);
  for (let i = 0; i < routeSegments; i++) {
    routeSeg[4 * i] = pc[2 * i];
    routeSeg[4 * i + 1] = pc[2 * i + 1];
    routeSeg[4 * i + 2] = pc[2 * i + 2];
    routeSeg[4 * i + 3] = pc[2 * i + 3];
    routeIdx[i] = i;
  }
  const jointIdx = new Float32Array(points);
  for (let i = 0; i < points; i++) jointIdx[i] = i - 1;

  return {
    steps,
    routeSegments,
    hue,
    explored,
    frontier,
    route: {
      length: routeSegments,
      attributes: {
        getSourcePosition: { value: routeSeg, size: 2, stride: 16, offset: 0 },
        getTargetPosition: { value: routeSeg, size: 2, stride: 16, offset: 8 },
        getFilterValue: { value: routeIdx, size: 1 },
      },
    },
    joints: {
      length: points,
      attributes: {
        getPosition: { value: pc, size: 2 },
        getFilterValue: { value: jointIdx, size: 1 },
      },
    },
    key: `t${++serial}`,
  };
}

/**
 * Layers for one frame.
 * @param drawn       explored steps to show
 * @param frontierLen how many of the most recent steps to emphasise
 * @param routeFrac   0..1 draw-in progress of the route
 * @param routeColor  color for the route
 * @param isSatellite whether satellite mode is active
 */
export function traceLayers(
  trace: PreparedTrace,
  drawn: number,
  frontierLen: number,
  routeFrac: number,
  routeColor: RGB,
  isSatellite = false,
): Layer[] {
  const palette = isSatellite ? SATELLITE_PALETTES[trace.hue] : PALETTES[trace.hue];
  const last = drawn - 1;
  const layers: Layer[] = [
    new LineLayer({
      id: `${trace.key}-explored`,
      data: trace.explored,
      widthUnits: "pixels",
      getWidth: isSatellite ? 1.5 : 1.25,
      extensions: [FILTER],
      filterRange: [0, last],
      parameters: { depthCompare: "always" },
    }),
  ];
  if (drawn > 0 && routeFrac < 1) {
    layers.push(
      new LineLayer({
        id: `${trace.key}-frontier`,
        data: trace.frontier,
        widthUnits: "pixels",
        getWidth: isSatellite ? 3.0 : 2.5,
        getColor: [...palette.frontier, 255],
        extensions: [FILTER],
        filterRange: [Math.max(0, drawn - frontierLen), last],
        parameters: { depthCompare: "always" },
      }),
    );
  }
  if (routeFrac > 0 && trace.routeSegments > 0) {
    // Show whole segments plus a partial joint so the line advances smoothly enough at any length.
    const shown = routeFrac * trace.routeSegments - 1;
    const common = { extensions: [FILTER], filterRange: [-1, shown] as [number, number], parameters: { depthCompare: "always" as const } };
    layers.push(
      new LineLayer({ id: `${trace.key}-casing`, data: trace.route, widthUnits: "pixels", getWidth: 8, getColor: PAPER, ...common }),
      new ScatterplotLayer({
        id: `${trace.key}-casing-joints`,
        data: trace.joints,
        radiusUnits: "pixels",
        getRadius: 4,
        getFillColor: PAPER,
        stroked: false,
        ...common,
      }),
      new LineLayer({ id: `${trace.key}-route`, data: trace.route, widthUnits: "pixels", getWidth: 4.5, getColor: [...routeColor, 255], ...common }),
      new ScatterplotLayer({
        id: `${trace.key}-route-joints`,
        data: trace.joints,
        radiusUnits: "pixels",
        getRadius: 2.25,
        getFillColor: [...routeColor, 255],
        stroked: false,
        ...common,
      }),
    );
  }
  return layers;
}

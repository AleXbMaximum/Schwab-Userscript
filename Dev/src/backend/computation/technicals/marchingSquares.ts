// Marching-squares contour extraction.
// Given a 2D grid of scalar values, extract iso-line segments at a threshold.

import { niceNum } from "./scale";

export type ContourSegment = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

// Edge interpolation tables for the 16 marching-squares cases.
// Each case maps to 0, 1, or 2 line segments expressed as pairs of edge IDs.
// Edges: 0=top, 1=right, 2=bottom, 3=left.

type Edge = 0 | 1 | 2 | 3;
const EDGE_TABLE: [Edge, Edge][][] = [
  /* 0b0000 */ [],
  /* 0b0001 */ [[0, 3]],
  /* 0b0010 */ [[0, 1]],
  /* 0b0011 */ [[1, 3]],
  /* 0b0100 */ [[1, 2]],
  /* 0b0101 */ [
    [0, 1],
    [2, 3],
  ], // saddle case A
  /* 0b0110 */ [[0, 2]],
  /* 0b0111 */ [[2, 3]],
  /* 0b1000 */ [[2, 3]],
  /* 0b1001 */ [[0, 2]],
  /* 0b1010 */ [
    [0, 3],
    [1, 2],
  ], // saddle case B
  /* 0b1011 */ [[1, 2]],
  /* 0b1100 */ [[1, 3]],
  /* 0b1101 */ [[0, 1]],
  /* 0b1110 */ [[0, 3]],
  /* 0b1111 */ [],
];

function edgeInterp(
  edge: Edge,
  tl: number,
  tr: number,
  br: number,
  bl: number,
  threshold: number,
  col: number,
  row: number,
): { x: number; y: number } {
  switch (edge) {
    case 0: {
      const t = (threshold - tl) / (tr - tl);
      return { x: col + t, y: row };
    }
    case 1: {
      const t = (threshold - tr) / (br - tr);
      return { x: col + 1, y: row + t };
    }
    case 2: {
      const t = (threshold - bl) / (br - bl);
      return { x: col + t, y: row + 1 };
    }
    case 3: {
      const t = (threshold - tl) / (bl - tl);
      return { x: col, y: row + t };
    }
  }
}

/**
 * Extract iso-line segments from a 2D grid at the given threshold.
 *
 * @param grid   - grid[row][col] scalar values; null entries skip the cell.
 * @param threshold - the scalar level to trace
 * @param rows   - number of rows in the grid
 * @param cols   - number of columns in the grid
 * @returns Line segments in fractional grid coordinates (col, row).
 */
export function marchingSquares(
  grid: (number | null)[][],
  threshold: number,
  rows: number,
  cols: number,
): ContourSegment[] {
  const segments: ContourSegment[] = [];

  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const tl = grid[r]?.[c];
      const tr = grid[r]?.[c + 1];
      const bl = grid[r + 1]?.[c];
      const br = grid[r + 1]?.[c + 1];

      if (tl == null || tr == null || bl == null || br == null) continue;

      const caseIdx =
        (tl >= threshold ? 1 : 0) |
        (tr >= threshold ? 2 : 0) |
        (br >= threshold ? 4 : 0) |
        (bl >= threshold ? 8 : 0);

      const edges = EDGE_TABLE[caseIdx];
      for (const [e1, e2] of edges) {
        const p1 = edgeInterp(e1, tl, tr, br, bl, threshold, c, r);
        const p2 = edgeInterp(e2, tl, tr, br, bl, threshold, c, r);
        segments.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
      }
    }
  }

  return segments;
}

/** Pick "nice" contour levels spanning the value range. */
export function pickContourLevels(
  minVal: number,
  maxVal: number,
  maxLevels: number = 8,
): number[] {
  if (!isFinite(minVal) || !isFinite(maxVal) || maxVal <= minVal) return [];

  const range = maxVal - minVal;
  const step = niceNum(range / maxLevels, true);
  if (step <= 0) return [];

  const levels: number[] = [];
  const start = Math.ceil(minVal / step) * step;
  for (let v = start; v < maxVal; v += step) {
    const rounded = Math.round(v * 1e6) / 1e6;
    if (rounded > minVal && rounded < maxVal) {
      levels.push(rounded);
    }
  }

  return levels;
}

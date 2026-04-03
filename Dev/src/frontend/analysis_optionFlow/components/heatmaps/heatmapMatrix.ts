// Shared matrix operations and grid calculations for GEX / OI heatmaps.

export type MatrixMode = "level" | "delta";
export type WindowPct = 1 | 2 | 3 | 5 | 10 | 15;

export function toDeltaMatrix(matrix: number[][]): number[][] {
  if (matrix.length === 0) return [];
  return matrix.map((row, rowIdx) => {
    if (rowIdx === 0) return row.map(() => 0);
    const prev = matrix[rowIdx - 1] ?? [];
    return row.map((value, colIdx) => {
      const curr = Number.isFinite(value) ? value : 0;
      const prevVal = Number.isFinite(prev[colIdx]) ? prev[colIdx] : 0;
      return curr - prevVal;
    });
  });
}

export function transposeMatrix(matrix: number[][]): number[][] {
  if (matrix.length === 0) return [];
  const rows = matrix.length;
  const cols = matrix[0].length;
  const result: number[][] = [];
  for (let c = 0; c < cols; c++) {
    result[c] = [];
    for (let r = 0; r < rows; r++) {
      result[c][r] = matrix[r][c];
    }
  }
  return result;
}

export function getMatrixBounds(matrix: number[][]): {
  min: number;
  max: number;
  absMax: number;
} {
  let min = Infinity;
  let max = -Infinity;
  for (const row of matrix) {
    for (const value of row) {
      if (!isFinite(value)) continue;
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  }
  if (!isFinite(min) || !isFinite(max)) {
    return { min: 0, max: 0, absMax: 1 };
  }
  const absMax = Math.max(Math.abs(min), Math.abs(max), 1);
  return { min, max, absMax };
}

export function getMedianSpot(spots: number[]): number {
  const valid = spots.filter((s) => s > 0);
  if (valid.length === 0) return 0;
  valid.sort((a, b) => a - b);
  return valid[Math.floor(valid.length / 2)];
}

export function niceIncrement(rawStep: number): number {
  if (rawStep <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;
  const target = normalized * 0.8;
  const niceOptions = [1, 2, 2.5, 5, 10];
  let nice = niceOptions[niceOptions.length - 1];
  for (const n of niceOptions) {
    if (n >= target) {
      nice = n;
      break;
    }
  }
  return magnitude * nice;
}

export function formatStrike(v: number): string {
  return v % 1 === 0 ? v.toFixed(0) : v.toFixed(1);
}

/**
 * Filter matrix columns to strikes within ±windowPct of median spot.
 * Works for any heatmap data that has spots + strikes arrays.
 */
export function filterByWindow(
  spots: number[],
  strikes: number[],
  matrix: number[][],
  windowPct: WindowPct,
): { strikes: number[]; matrix: number[][] } {
  const validSpots = spots.filter((s) => s > 0);
  if (validSpots.length === 0) return { strikes, matrix };
  validSpots.sort((a, b) => a - b);
  const medianSpot = validSpots[Math.floor(validSpots.length / 2)];

  const lo = medianSpot * (1 - windowPct / 100);
  const hi = medianSpot * (1 + windowPct / 100);

  const indices: number[] = [];
  for (let i = 0; i < strikes.length; i++) {
    if (strikes[i] >= lo && strikes[i] <= hi) indices.push(i);
  }
  if (indices.length === 0) return { strikes, matrix };

  return {
    strikes: indices.map((i) => strikes[i]),
    matrix: matrix.map((row) => indices.map((i) => row[i])),
  };
}

export function snapToGrid(
  strikes: number[],
  matrix: number[][],
  medianSpot: number,
  maxCols: number,
): { strikes: number[]; matrix: number[][] } {
  if (strikes.length <= maxCols) return { strikes, matrix };

  const range = strikes[strikes.length - 1] - strikes[0];
  const inc = niceIncrement(range / maxCols);

  const center =
    medianSpot > 0
      ? Math.round(medianSpot / inc) * inc
      : Math.round((strikes[0] + strikes[strikes.length - 1]) / 2 / inc) * inc;

  const gridTargets: number[] = [];
  const halfCount = Math.ceil(maxCols / 2);
  for (let i = -halfCount; i <= halfCount; i++) {
    const v = center + i * inc;
    if (
      v >= strikes[0] - inc * 0.5 &&
      v <= strikes[strikes.length - 1] + inc * 0.5
    ) {
      gridTargets.push(v);
    }
  }

  const usedIndices = new Set<number>();
  const selectedIndices: number[] = [];
  for (const target of gridTargets) {
    let bestIdx = 0;
    let bestDist = Math.abs(strikes[0] - target);
    for (let j = 1; j < strikes.length; j++) {
      const dist = Math.abs(strikes[j] - target);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = j;
      }
    }
    if (!usedIndices.has(bestIdx) && bestDist <= inc * 0.6) {
      usedIndices.add(bestIdx);
      selectedIndices.push(bestIdx);
    }
  }

  if (selectedIndices.length === 0) return { strikes, matrix };

  return {
    strikes: selectedIndices.map((i) => strikes[i]),
    matrix: matrix.map((row) => selectedIndices.map((i) => row[i])),
  };
}

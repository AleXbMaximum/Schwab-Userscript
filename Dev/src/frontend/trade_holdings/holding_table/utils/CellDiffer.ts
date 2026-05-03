import type { HoldingsTableColumnId } from "../../../../shared/types/holdingsTableColumns";
import { NUMERIC_FLASH_COLUMNS } from "../table/columnMetadata";
import { generateCellKey } from "./RowKeyGenerator";

export type ChangeType = "structural" | "positional" | "value-only" | "none";

export interface CellChange {
  rowKey: string;
  columnId: HoldingsTableColumnId;
  cellKey: string;
  changeType: ChangeType;
  oldValue: string | null;
  newValue: string;
  direction: "up" | "down" | "none";
}

export interface RowDiff {
  rowKey: string;
  changeType: "added" | "removed" | "moved" | "stable";
  cellChanges: Map<HoldingsTableColumnId, CellChange>;
}

export interface DiffResult {
  rows: Map<string, RowDiff>;
  hasStructuralChanges: boolean;
  valueOnlyChanges: CellChange[];
}

const STRIP_NON_NUMERIC = /[^0-9.-]/g;

function parseFormattedNumber(s: string): number {
  return parseFloat(s.replace(STRIP_NON_NUMERIC, ""));
}

export class CellDiffer {
  private prevRowKeys: string[] = [];
  private prevRowValues = new Map<string, Map<HoldingsTableColumnId, string>>();

  diff(
    currentRowKeys: string[],
    currentRowValues: Map<string, Map<HoldingsTableColumnId, string>>,
    columnIds: HoldingsTableColumnId[],
  ): DiffResult {
    const prevKeySet = new Set(this.prevRowKeys);
    const currKeySet = new Set(currentRowKeys);

    const rows = new Map<string, RowDiff>();
    const valueOnlyChanges: CellChange[] = [];
    let hasStructuralChanges = false;

    const prevPositions = new Map<string, number>();
    this.prevRowKeys.forEach((key, idx) => prevPositions.set(key, idx));

    const currPositions = new Map<string, number>();
    currentRowKeys.forEach((key, idx) => currPositions.set(key, idx));

    for (let i = 0; i < currentRowKeys.length; i++) {
      const rowKey = currentRowKeys[i];
      const currValues = currentRowValues.get(rowKey) ?? new Map();
      const prevValues = this.prevRowValues.get(rowKey);
      const wasPresent = prevKeySet.has(rowKey);

      let rowChangeType: "added" | "removed" | "moved" | "stable";
      if (!wasPresent) {
        rowChangeType = "added";
        hasStructuralChanges = true;
      } else {
        const prevPos = prevPositions.get(rowKey)!;
        rowChangeType = prevPos !== i ? "moved" : "stable";
      }

      const cellChanges = new Map<HoldingsTableColumnId, CellChange>();

      for (const colId of columnIds) {
        const newVal = currValues.get(colId) ?? "";
        const oldVal = prevValues?.get(colId) ?? null;
        const cellKey = generateCellKey(rowKey, colId);

        let cellChangeType: ChangeType;
        if (rowChangeType === "added") {
          cellChangeType = "structural";
        } else if (rowChangeType === "moved") {
          cellChangeType = oldVal !== newVal ? "positional" : "none";
        } else {
          cellChangeType = oldVal !== newVal ? "value-only" : "none";
        }

        let direction: "up" | "down" | "none" = "none";
        if (
          cellChangeType === "value-only" &&
          oldVal !== null &&
          NUMERIC_FLASH_COLUMNS.has(colId)
        ) {
          const oldNum = parseFormattedNumber(oldVal);
          const newNum = parseFormattedNumber(newVal);
          if (!isNaN(oldNum) && !isNaN(newNum) && oldNum !== newNum) {
            direction = newNum > oldNum ? "up" : "down";
          }
        }

        const change: CellChange = {
          rowKey,
          columnId: colId,
          cellKey,
          changeType: cellChangeType,
          oldValue: oldVal,
          newValue: newVal,
          direction,
        };

        if (cellChangeType !== "none") {
          cellChanges.set(colId, change);
        }

        if (cellChangeType === "value-only") {
          valueOnlyChanges.push(change);
        }
      }

      rows.set(rowKey, { rowKey, changeType: rowChangeType, cellChanges });
    }

    for (const prevKey of this.prevRowKeys) {
      if (!currKeySet.has(prevKey)) {
        rows.set(prevKey, {
          rowKey: prevKey,
          changeType: "removed",
          cellChanges: new Map(),
        });
        hasStructuralChanges = true;
      }
    }

    this.prevRowKeys = [...currentRowKeys];
    // Swap reference instead of deep-copying each Map.
    // Safe because currentRowValues is built fresh per render cycle.
    this.prevRowValues = currentRowValues;

    return { rows, hasStructuralChanges, valueOnlyChanges };
  }

  reset(): void {
    this.prevRowKeys = [];
    this.prevRowValues.clear();
  }

  isRowStable(rowKey: string, currentPosition: number): boolean {
    const prevPos = this.prevRowKeys.indexOf(rowKey);
    return prevPos >= 0 && prevPos === currentPosition;
  }
}

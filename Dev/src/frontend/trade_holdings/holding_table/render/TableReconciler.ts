import type { HoldingsTableColumnId } from "../../../../shared/types/holdingsTableColumns";
import type { RowRenderData } from "../types";
import { generateCellKey } from "../utils/RowKeyGenerator";
import { CellDiffer, type RowDiff } from "../utils/CellDiffer";
import { FlashAnimator } from "./FlashAnimator";
import { ColumnWidthCalculator } from "../utils/ColumnWidthCalculator";
import {
  renderSymbolCell,
  renderNumericCell,
  renderGroupCell,
  renderTextCell,
  applyStickyClass,
  applyRowClasses,
  normalizeLinkSymbol,
} from "./CellRenderers";

export interface ReconcilerConfig {
  tbody: HTMLTableSectionElement;
  columnIds: HoldingsTableColumnId[];
  columnWidthCalculator: ColumnWidthCalculator;
  flashAnimator: FlashAnimator;
  /** When true, apply sticky-right positioning on the trailing action cell. */
  hasStickyActions?: boolean;
}

export class TableReconciler {
  private readonly config: ReconcilerConfig;
  private readonly differ: CellDiffer;
  private rowsByKey = new Map<string, HTMLTableRowElement>();
  private currentRowOrder: string[] = [];
  private cellRegistry = new Map<string, WeakRef<HTMLTableCellElement>>();
  private shortRowKeys = new Set<string>();
  private badgeSignatureByRowKey = new Map<string, string>();

  constructor(config: ReconcilerConfig) {
    this.config = config;
    this.differ = new CellDiffer();
  }

  /** Reconcile the DOM to match the given virtual rows.
   *  Returns the set of row keys that were actually patched (not stable-noop). */
  reconcile(rows: RowRenderData[]): Set<string> {
    const { tbody, columnIds, columnWidthCalculator, flashAnimator } =
      this.config;
    const symbolColumnIndex = columnIds.indexOf("symbol");
    columnWidthCalculator.resetSymbolColumnWidth();
    const nextBadgeSignatureByRowKey = new Map<string, string>();
    const patchedKeys = new Set<string>();

    const currentRowKeys: string[] = [];
    const currentRowValues = new Map<
      string,
      Map<HoldingsTableColumnId, string>
    >();
    const rowDataByKey = new Map<string, RowRenderData>();

    for (const rowData of rows) {
      currentRowKeys.push(rowData.key);
      currentRowValues.set(rowData.key, rowData.values);
      rowDataByKey.set(rowData.key, rowData);

      if (rowData.isShort) {
        this.shortRowKeys.add(rowData.key);
      } else {
        this.shortRowKeys.delete(rowData.key);
      }
    }

    const diffResult = this.differ.diff(
      currentRowKeys,
      currentRowValues,
      columnIds,
    );

    const existingRowMap = new Map(this.rowsByKey);
    const spareRows: HTMLTableRowElement[] = [];
    const newRowsByKey = new Map<string, HTMLTableRowElement>();

    for (const [key, row] of existingRowMap) {
      if (!rowDataByKey.has(key)) {
        spareRows.push(row);
      }
    }

    for (let i = 0; i < rows.length; i++) {
      const rowData = rows[i];
      const key = rowData.key;
      const rowDiff = diffResult.rows.get(key);
      const nextBadgeSignature = rowData.isSummary
        ? (rowData.badgeSignature ?? "")
        : "";
      const prevBadgeSignature = this.badgeSignatureByRowKey.get(key) ?? "";
      const shouldForceSymbolPatch =
        rowData.isSummary && nextBadgeSignature !== prevBadgeSignature;
      if (rowData.isSummary) {
        nextBadgeSignatureByRowKey.set(key, nextBadgeSignature);
      }

      let tr = existingRowMap.get(key);
      const reusedByKey = !!tr;

      if (!tr) {
        tr = spareRows.pop() ?? tbody.insertRow();
      }

      const expectedAt = tbody.rows.item(i);
      if (expectedAt !== tr) {
        tbody.insertBefore(tr, expectedAt ?? null);
      }
      newRowsByKey.set(key, tr);

      const rowIsStableNoop =
        reusedByKey &&
        rowDiff?.changeType === "stable" &&
        (!rowDiff.cellChanges || rowDiff.cellChanges.size === 0) &&
        !shouldForceSymbolPatch;

      if (!rowIsStableNoop) {
        patchedKeys.add(key);
        this.patchRow(
          tr,
          rowData,
          rowDiff,
          reusedByKey,
          i,
          shouldForceSymbolPatch,
        );

        this.registerRowCells(key, tr, columnIds);

        const measureAllColumns =
          !reusedByKey || rowDiff?.changeType === "added";
        for (let colIdx = 0; colIdx < columnIds.length; colIdx++) {
          const colId = columnIds[colIdx];
          if (
            !measureAllColumns &&
            rowDiff?.cellChanges &&
            !rowDiff.cellChanges.has(colId)
          ) {
            continue;
          }
          const value = rowData.values.get(columnIds[colIdx]) ?? "";
          columnWidthCalculator.updateColumnWidth(colIdx, value);
        }
      }

      // Symbol-column max resets per frame, so every row must push its
      // contribution unconditionally — child rows use their own font/padX
      // (via measureSymbolCellTotalPx) instead of a global indent fudge.
      if (symbolColumnIndex >= 0) {
        const symbolText = rowData.values.get("symbol") ?? "";
        const symbolFullPx = columnWidthCalculator.measureSymbolCellTotalPx(
          symbolText,
          !!rowData.isChild,
          0,
        );
        columnWidthCalculator.recordSymbolCellWidth(symbolFullPx);
      }
    }

    for (const row of spareRows) {
      row.remove();
    }

    this.rowsByKey = newRowsByKey;
    this.currentRowOrder = currentRowKeys;
    this.badgeSignatureByRowKey = nextBadgeSignatureByRowKey;

    flashAnimator.processCellChanges(
      diffResult.valueOnlyChanges,
      (rowKey, columnId) => this.getCellElement(rowKey, columnId),
      (rowKey) => this.shortRowKeys.has(rowKey),
    );

    return patchedKeys;
  }

  private patchRow(
    tr: HTMLTableRowElement,
    rowData: RowRenderData,
    rowDiff: RowDiff | undefined,
    reusedByKey: boolean,
    _rowIndex: number,
    forceSymbolCellPatch: boolean,
  ): void {
    const { columnIds } = this.config;
    const columnCount = columnIds.length;

    while (tr.cells.length < columnCount + 1) {
      tr.insertCell();
    }

    applyRowClasses(tr, {
      isChild: rowData.isChild,
      isSummary: rowData.isSummary,
      isGroup: rowData.type === "group",
      isMajorGroup: rowData.isMajorGroup,
    });

    if (rowData.isSummary) {
      tr.style.cursor = "pointer";
    } else {
      tr.style.cursor = "";
      tr.onclick = null;
    }

    const isStructural =
      !reusedByKey ||
      rowDiff?.changeType === "added" ||
      rowDiff?.changeType === "moved";
    const cellChanges = rowDiff?.cellChanges;

    for (let colIdx = 0; colIdx < columnCount; colIdx++) {
      const colId = columnIds[colIdx];
      const td = tr.cells[colIdx] as HTMLTableCellElement;
      const value = rowData.values.get(colId) ?? "";

      if (
        !isStructural &&
        cellChanges &&
        !cellChanges.has(colId) &&
        !(forceSymbolCellPatch && colId === "symbol")
      ) {
        continue;
      }

      if (rowData.type === "group" && colIdx === 0) {
        renderGroupCell(td, {
          name: rowData.groupName ?? "",
          totals: rowData.totals,
        });
      } else if (colId === "symbol") {
        const displayText = value;
        const linkSymbol = normalizeLinkSymbol(rowData.linkTarget ?? value);
        renderSymbolCell(td, {
          displayText,
          linkSymbol,
          linkKind: rowData.linkKind ?? "stock",
          isChild: rowData.isChild ?? false,
          assetBadges: rowData.assetBadges,
          showSparkline: rowData.isSummary === true,
        });
      } else if (colId === "name") {
        renderTextCell(td, value, "left");
      } else {
        renderNumericCell(td, {
          value,
          columnId: colId,
          isShort: rowData.isShort ?? false,
          isSummary: rowData.isSummary ?? false,
        });
      }

      if (colIdx === 0) {
        applyStickyClass(td);
      }
    }

    // Set data-underlying for summary rows (used by delegated click handler)
    if (rowData.isSummary && rowData.linkTarget) {
      tr.setAttribute("data-underlying", rowData.linkTarget);
    }

    const spacerCell = tr.cells[columnCount];
    if (spacerCell) {
      if (isStructural) {
        spacerCell.textContent = "";
        spacerCell.removeAttribute("data-actions-for");
      }
      spacerCell.classList.add("table-cell-spacer");

      // Apply sticky-right positioning for the trailing action column
      if (
        this.config.hasStickyActions &&
        !spacerCell.classList.contains("table-cell-sticky-right")
      ) {
        spacerCell.classList.add("table-cell-sticky-right");
        spacerCell.style.setProperty("position", "sticky", "important");
        spacerCell.style.setProperty("right", "0", "important");
        spacerCell.style.setProperty("z-index", "10", "important");
      }
    }
  }

  private registerRowCells(
    rowKey: string,
    tr: HTMLTableRowElement,
    columnIds: HoldingsTableColumnId[],
  ): void {
    for (let i = 0; i < columnIds.length; i++) {
      const cellKey = generateCellKey(rowKey, columnIds[i]);
      const cell = tr.cells[i] as HTMLTableCellElement;
      if (cell) {
        this.cellRegistry.set(cellKey, new WeakRef(cell));
      }
    }
  }

  getCellElement(
    rowKey: string,
    columnId: HoldingsTableColumnId,
  ): HTMLTableCellElement | null {
    const cellKey = generateCellKey(rowKey, columnId);
    const ref = this.cellRegistry.get(cellKey);
    if (!ref) return null;

    const cell = ref.deref();
    if (!cell) {
      this.cellRegistry.delete(cellKey);
      return null;
    }
    return cell;
  }

  getRowElement(rowKey: string): HTMLTableRowElement | null {
    return this.rowsByKey.get(rowKey) ?? null;
  }

  reset(): void {
    this.rowsByKey.clear();
    this.currentRowOrder = [];
    this.cellRegistry.clear();
    this.shortRowKeys.clear();
    this.badgeSignatureByRowKey.clear();
    this.differ.reset();
  }

  cleanupStaleRefs(): void {
    for (const [key, ref] of this.cellRegistry) {
      if (!ref.deref()) {
        this.cellRegistry.delete(key);
      }
    }
  }
}

import type { HoldingsTableColumnId } from "../../../../shared/holdingsTableColumns";
import {
  BASE_COL_LABELS,
  BASE_INDEX_BY_ID,
  DERIVED_HEADER_COLUMNS,
} from "../table/columnMetadata";
import type { SortState, TableActionsConfig } from "../types";

export interface TableHeaderConfig {
  table: HTMLTableElement;
  displayColumnIds: HoldingsTableColumnId[];
  actionsConfig?: TableActionsConfig;
  onSortChange?: (sortState: SortState) => void;
  onColumnOrderChange?: (newOrder: HoldingsTableColumnId[]) => void;
}

export interface TableHeaderBindings {
  cols: HTMLTableColElement[];
  headerRow: HTMLTableRowElement;
  tbody: HTMLTableSectionElement;
  columnCount: number;
  symbolColumnIndex: number;
  getSortState: () => SortState;
  setSortState: (sortState: SortState) => void;
}

export const createTableHeaderBindings = (
  config: TableHeaderConfig,
): TableHeaderBindings => {
  const { table, displayColumnIds, actionsConfig } = config;
  const columnCount = displayColumnIds.length;
  const symbolColumnIndex = displayColumnIds.indexOf("symbol");

  const colgroup = document.createElement("colgroup");
  const cols: HTMLTableColElement[] = [];
  for (let i = 0; i < columnCount + 1; i++) {
    const col = document.createElement("col");
    cols.push(col);
    colgroup.appendChild(col);
  }
  table.appendChild(colgroup);

  const thead = table.createTHead();
  thead.className = "ios-table-head";
  const headerRow = thead.insertRow();

  let currentSortState: SortState = { colId: null, asc: true };
  const headerCells = new Map<HoldingsTableColumnId, HTMLTableCellElement>();

  const updateSortIndicators = () => {
    for (const [id, cell] of headerCells) {
      if (currentSortState.colId === id) {
        cell.setAttribute("data-sort", currentSortState.asc ? "asc" : "desc");
      } else {
        cell.removeAttribute("data-sort");
      }
    }
  };

  let dragSourceColIdx: number | null = null;

  displayColumnIds.forEach((colId, colIdx) => {
    const baseIndex = BASE_INDEX_BY_ID.get(colId) ?? 0;
    const label = BASE_COL_LABELS[baseIndex] ?? String(colId);
    const th = document.createElement("th");
    const isDerivedHeader = DERIVED_HEADER_COLUMNS.has(colId);
    th.textContent = String(label);
    th.className =
      colId === "symbol"
        ? "table-header-cell table-header-cell--sticky"
        : "table-header-cell";

    if (colId === "symbol") {
      th.style.setProperty("position", "sticky", "important");
      th.style.setProperty("left", "0", "important");
      th.style.setProperty(
        "z-index",
        "var(--z-table-sticky-header, 32)",
        "important",
      );
    }

    if (isDerivedHeader) th.classList.add("table-header-cell--derived");
    headerCells.set(colId, th);

    th.onclick = () => {
      if (currentSortState.colId === colId) {
        currentSortState = currentSortState.asc
          ? { colId: null, asc: true }
          : { colId, asc: true };
      } else {
        currentSortState = { colId, asc: false };
      }
      updateSortIndicators();
      config.onSortChange?.(currentSortState);
    };

    if (colId !== "symbol") {
      th.draggable = true;

      th.addEventListener("dragstart", (e) => {
        dragSourceColIdx = colIdx;
        e.dataTransfer!.effectAllowed = "move";
        e.dataTransfer!.setData("text/plain", String(colIdx));
        th.classList.add("table-header-cell--dragging");
      });

      th.addEventListener("dragend", () => {
        dragSourceColIdx = null;
        th.classList.remove("table-header-cell--dragging");
        headerRow
          .querySelectorAll(
            ".table-header-cell--drop-left, .table-header-cell--drop-right",
          )
          .forEach((el) =>
            el.classList.remove(
              "table-header-cell--drop-left",
              "table-header-cell--drop-right",
            ),
          );
      });

      th.addEventListener("dragover", (e) => {
        if (dragSourceColIdx === null || dragSourceColIdx === colIdx) return;
        e.preventDefault();
        e.dataTransfer!.dropEffect = "move";
        const rect = th.getBoundingClientRect();
        const midX = rect.left + rect.width / 2;
        th.classList.remove(
          "table-header-cell--drop-left",
          "table-header-cell--drop-right",
        );
        th.classList.add(
          e.clientX < midX
            ? "table-header-cell--drop-left"
            : "table-header-cell--drop-right",
        );
      });

      th.addEventListener("dragleave", () => {
        th.classList.remove(
          "table-header-cell--drop-left",
          "table-header-cell--drop-right",
        );
      });

      th.addEventListener("drop", (e) => {
        e.preventDefault();
        headerRow
          .querySelectorAll(
            ".table-header-cell--drop-left, .table-header-cell--drop-right",
          )
          .forEach((el) =>
            el.classList.remove(
              "table-header-cell--drop-left",
              "table-header-cell--drop-right",
            ),
          );

        const fromIdx = parseInt(e.dataTransfer!.getData("text/plain"), 10);
        if (isNaN(fromIdx) || fromIdx === colIdx || fromIdx === 0) return;

        const rect = th.getBoundingClientRect();
        const dropBefore = e.clientX < rect.left + rect.width / 2;
        const newOrder = [...displayColumnIds];
        const [moved] = newOrder.splice(fromIdx, 1);
        let insertAt: number;
        if (dropBefore) {
          insertAt = fromIdx < colIdx ? colIdx - 1 : colIdx;
        } else {
          insertAt = fromIdx < colIdx ? colIdx : colIdx + 1;
        }
        insertAt = Math.max(1, Math.min(insertAt, newOrder.length));
        newOrder.splice(insertAt, 0, moved);
        config.onColumnOrderChange?.(newOrder);
      });
    }

    headerRow.appendChild(th);
  });

  const spacerTh = document.createElement("th");
  if (actionsConfig) {
    spacerTh.className = "table-header-cell table-header-cell--sticky-right";
    spacerTh.textContent = "Actions";
    spacerTh.style.setProperty("position", "sticky", "important");
    spacerTh.style.setProperty("right", "0", "important");
    spacerTh.style.setProperty(
      "z-index",
      "var(--z-table-sticky-header, 32)",
      "important",
    );
  } else {
    spacerTh.className = "table-header-cell table-header-cell--spacer";
  }
  headerRow.appendChild(spacerTh);

  const tbody = table.createTBody();

  return {
    cols,
    headerRow,
    tbody,
    columnCount,
    symbolColumnIndex,
    getSortState: () => currentSortState,
    setSortState: (sortState: SortState) => {
      currentSortState = sortState;
      updateSortIndicators();
    },
  };
};

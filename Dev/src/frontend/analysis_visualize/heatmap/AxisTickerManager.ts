import { ui_createElement } from "../../components/core/createElement";

const AXIS_LABEL_STYLE =
  "font-size: 10px; font-weight: 600; color: var(--ios-text-secondary, #8e8e93);" +
  " text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;";

const CHIP_STYLE =
  "display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px;" +
  " font-size: 10px; font-weight: 600; border-radius: 6px; cursor: grab;" +
  " background: rgba(0,0,0,0.04); color: var(--ios-text-primary);" +
  " border: 1px solid var(--ios-border, rgba(230,230,230,0.7));" +
  " transition: opacity 150ms, border-color 150ms;";

const TICKER_INPUT_STYLE =
  "width: 70px; padding: 3px 6px; font-size: 10px; border-radius: 6px;" +
  " border: 1px solid var(--ios-border, rgba(230,230,230,0.7));" +
  " font-family: var(--ios-font, inherit); text-transform: uppercase;" +
  " background: rgba(255,255,255,0.6);";

export type AxisTickerState = {
  rowTickers: string[];
  colTickers: string[];
};

export type AxisTickerCallbacks = {
  onSave: () => void;
};

export function createAxisTickerManager(
  state: AxisTickerState,
  callbacks: AxisTickerCallbacks,
  actionBtnStyle: string,
): {
  rowSection: {
    container: HTMLElement;
    headerRow: HTMLElement;
    tagsRow: HTMLElement;
  };
  colSection: {
    container: HTMLElement;
    headerRow: HTMLElement;
    tagsRow: HTMLElement;
  };
  renderAxisTags: (axis: "row" | "col") => void;
} {
  // Drag state scoped per-axis
  let dragState: { ticker: string; axis: "row" | "col" } | null = null;

  function getAxisList(axis: "row" | "col"): string[] {
    return axis === "row" ? state.rowTickers : state.colTickers;
  }

  function setAxisList(axis: "row" | "col", list: string[]): void {
    if (axis === "row") state.rowTickers = list;
    else state.colTickers = list;
  }

  function getTagsRow(axis: "row" | "col"): HTMLElement {
    return axis === "row" ? rowSection.tagsRow : colSection.tagsRow;
  }

  /** Remove ticker from its source axis and insert into target axis at `insertIdx`. */
  function moveTicker(
    srcAxis: "row" | "col",
    ticker: string,
    dstAxis: "row" | "col",
    insertIdx: number,
  ): void {
    const srcList = getAxisList(srcAxis);
    const fromIdx = srcList.indexOf(ticker);
    if (fromIdx < 0) return;
    srcList.splice(fromIdx, 1);

    const dstList = getAxisList(dstAxis);
    // Clamp insert index after removal (source may have shrunk if same list)
    const idx = Math.min(insertIdx, dstList.length);
    dstList.splice(idx, 0, ticker);

    callbacks.onSave();
    renderAxisTags("row");
    renderAxisTags("col");
  }

  function renderAxisTags(axis: "row" | "col"): void {
    const tagsRow = getTagsRow(axis);
    const list = getAxisList(axis);
    tagsRow.innerHTML = "";

    for (const ticker of list) {
      const chip = ui_createElement("span", { styleString: CHIP_STYLE });
      chip.draggable = true;

      chip.addEventListener("dragstart", (e) => {
        dragState = { ticker, axis };
        (e as DragEvent).dataTransfer!.effectAllowed = "move";
        chip.style.opacity = "0.4";
      });

      chip.addEventListener("dragend", () => {
        chip.style.opacity = "1";
        dragState = null;
      });

      chip.addEventListener("dragover", (e) => {
        e.preventDefault();
        if (!dragState || dragState.ticker === ticker) return;
        (e as DragEvent).dataTransfer!.dropEffect = "move";
        chip.style.borderColor = "rgba(0,122,255,0.5)";
      });

      chip.addEventListener("dragleave", () => {
        chip.style.borderColor = "";
      });

      chip.addEventListener("drop", (e) => {
        e.preventDefault();
        chip.style.borderColor = "";
        if (!dragState || dragState.ticker === ticker) return;
        const targetIdx = getAxisList(axis).indexOf(ticker);
        moveTicker(dragState.axis, dragState.ticker, axis, targetIdx);
        dragState = null;
      });

      chip.appendChild(document.createTextNode(ticker));

      const removeBtn = ui_createElement("span", {
        text: "\u00d7",
        styleString:
          "cursor: pointer; font-size: 12px; line-height: 1; opacity: 0.5;",
        events: {
          click: () => {
            setAxisList(
              axis,
              getAxisList(axis).filter((t) => t !== ticker),
            );
            callbacks.onSave();
            renderAxisTags(axis);
          },
        },
      });
      chip.appendChild(removeBtn);

      tagsRow.appendChild(chip);
    }

    // Allow dropping onto empty area of tags row (append to end)
    tagsRow.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (!dragState) return;
      (e as DragEvent).dataTransfer!.dropEffect = "move";
    });
    tagsRow.addEventListener("drop", (e) => {
      // Only handle if the drop target is the row itself (not a chip)
      if ((e as Event).target !== tagsRow || !dragState) return;
      e.preventDefault();
      moveTicker(
        dragState.axis,
        dragState.ticker,
        axis,
        getAxisList(axis).length,
      );
      dragState = null;
    });
  }

  function createAxisSection(
    label: string,
    axis: "row" | "col",
  ): { container: HTMLElement; headerRow: HTMLElement; tagsRow: HTMLElement } {
    const container = ui_createElement("div", {
      styleString: "margin-bottom: 6px;",
    });

    const headerRow = ui_createElement("div", {
      styleString:
        "display: flex; align-items: center; gap: 6px; margin-bottom: 3px;",
    });
    headerRow.appendChild(
      ui_createElement("span", { text: label, styleString: AXIS_LABEL_STYLE }),
    );

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Add ticker";
    input.style.cssText = TICKER_INPUT_STYLE;

    const addBtn = ui_createElement("button", {
      text: "+",
      styleString:
        actionBtnStyle +
        " padding: 2px 8px; font-size: 10px; border-radius: 6px;",
    }) as HTMLButtonElement;

    const addTicker = () => {
      const raw = input.value.trim().toUpperCase();
      if (!raw) return;
      const list = axis === "row" ? state.rowTickers : state.colTickers;
      if (!list.includes(raw)) {
        list.push(raw);
        callbacks.onSave();
        renderAxisTags(axis);
      }
      input.value = "";
    };
    addBtn.addEventListener("click", addTicker);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") addTicker();
    });

    headerRow.appendChild(input);
    headerRow.appendChild(addBtn);
    container.appendChild(headerRow);

    const tagsRow = ui_createElement("div", {
      styleString: "display: flex; flex-wrap: wrap; gap: 4px;",
    });
    container.appendChild(tagsRow);

    return { container, headerRow, tagsRow };
  }

  const rowSection = createAxisSection("Watchlist", "row");
  const colSection = createAxisSection("Indicators", "col");

  renderAxisTags("row");
  renderAxisTags("col");

  return { rowSection, colSection, renderAxisTags };
}

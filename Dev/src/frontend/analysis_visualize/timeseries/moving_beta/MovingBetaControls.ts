import { ui_createElement } from "../../../components/core/createElement";

const AXIS_LABEL_STYLE =
  "font-size: 10px; font-weight: 600; color: var(--ios-text-secondary, #8e8e93);" +
  " text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;";

const CHIP_STYLE =
  "display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px;" +
  " font-size: 10px; font-weight: 600; border-radius: 6px; cursor: grab;" +
  " background: rgba(0,0,0,0.04); color: var(--ios-text-primary);" +
  " border: 1px solid var(--ios-border, rgba(230,230,230,0.7));" +
  " transition: opacity 150ms, border-color 150ms, background 150ms;";

const CHIP_ACTIVE_STYLE =
  "background: rgba(0,122,255,0.1); border-color: rgba(0,122,255,0.5); color: rgb(0,122,255);";

const TICKER_INPUT_STYLE =
  "width: 70px; padding: 3px 6px; font-size: 10px; border-radius: 6px;" +
  " border: 1px solid var(--ios-border, rgba(230,230,230,0.7));" +
  " font-family: var(--ios-font, inherit); text-transform: uppercase;" +
  " background: rgba(255,255,255,0.6);";

export type MovingBetaAxisState = {
  watchlistTickers: string[];
  indicatorTickers: string[];
  selectedBenchmark: string;
};

export type MovingBetaAxisCallbacks = {
  onSave: () => void;
  onBenchmarkChange: (benchmark: string) => void;
};

type AxisSection = {
  container: HTMLElement;
  headerRow: HTMLElement;
  tagsRow: HTMLElement;
};

export function createMovingBetaAxisSections(
  state: MovingBetaAxisState,
  callbacks: MovingBetaAxisCallbacks,
  buttonStyle: string,
): {
  watchlistSection: AxisSection;
  indicatorSection: AxisSection;
  renderAxisTags: (axis: "watchlist" | "indicator") => void;
} {
  let dragState: { ticker: string; axis: "watchlist" | "indicator" } | null =
    null;

  function getAxisList(axis: "watchlist" | "indicator"): string[] {
    return axis === "watchlist" ? state.watchlistTickers : state.indicatorTickers;
  }

  function setAxisList(axis: "watchlist" | "indicator", list: string[]): void {
    if (axis === "watchlist") state.watchlistTickers = list;
    else state.indicatorTickers = list;
  }

  function getTagsRow(axis: "watchlist" | "indicator"): HTMLElement {
    return axis === "watchlist"
      ? watchlistSection.tagsRow
      : indicatorSection.tagsRow;
  }

  function moveTicker(
    srcAxis: "watchlist" | "indicator",
    ticker: string,
    dstAxis: "watchlist" | "indicator",
    insertIdx: number,
  ): void {
    const srcList = getAxisList(srcAxis);
    const fromIdx = srcList.indexOf(ticker);
    if (fromIdx < 0) return;
    srcList.splice(fromIdx, 1);

    const dstList = getAxisList(dstAxis);
    const idx = Math.min(insertIdx, dstList.length);
    dstList.splice(idx, 0, ticker);

    callbacks.onSave();
    renderAxisTags("watchlist");
    renderAxisTags("indicator");
  }

  function renderAxisTags(axis: "watchlist" | "indicator"): void {
    const tagsRow = getTagsRow(axis);
    const list = getAxisList(axis);
    tagsRow.innerHTML = "";

    for (const ticker of list) {
      const chip = ui_createElement("span", { styleString: CHIP_STYLE });
      chip.draggable = true;

      // For indicators, highlight the active benchmark
      if (axis === "indicator" && ticker === state.selectedBenchmark) {
        chip.style.cssText += CHIP_ACTIVE_STYLE;
      }

      // Click to select benchmark (indicator axis only)
      if (axis === "indicator") {
        chip.style.cursor = "pointer";
        chip.addEventListener("click", (e) => {
          if ((e.target as HTMLElement).textContent === "\u00d7") return;
          state.selectedBenchmark = ticker;
          callbacks.onBenchmarkChange(ticker);
          renderAxisTags("indicator");
        });
      }

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
            if (axis === "indicator" && ticker === state.selectedBenchmark) {
              state.selectedBenchmark = state.indicatorTickers[0] || "";
              callbacks.onBenchmarkChange(state.selectedBenchmark);
            }
            renderAxisTags(axis);
          },
        },
      });
      chip.appendChild(removeBtn);

      tagsRow.appendChild(chip);
    }

    // Drop on empty area → append
    tagsRow.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (!dragState) return;
      (e as DragEvent).dataTransfer!.dropEffect = "move";
    });
    tagsRow.addEventListener("drop", (e) => {
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
    axis: "watchlist" | "indicator",
  ): AxisSection {
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
        buttonStyle +
        " padding: 2px 8px; font-size: 10px; border-radius: 6px; flex-shrink: 0;",
    }) as HTMLButtonElement;

    const addTicker = () => {
      const raw = input.value.trim().toUpperCase();
      if (!raw) return;
      const list = getAxisList(axis);
      if (!list.includes(raw)) {
        list.push(raw);
        callbacks.onSave();
        renderAxisTags(axis);
        // Auto-select first indicator if none selected
        if (axis === "indicator" && state.indicatorTickers.length === 1) {
          state.selectedBenchmark = raw;
          callbacks.onBenchmarkChange(raw);
        }
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

  const watchlistSection = createAxisSection("Watchlist", "watchlist");
  const indicatorSection = createAxisSection("Indicators", "indicator");

  renderAxisTags("watchlist");
  renderAxisTags("indicator");

  return { watchlistSection, indicatorSection, renderAxisTags };
}

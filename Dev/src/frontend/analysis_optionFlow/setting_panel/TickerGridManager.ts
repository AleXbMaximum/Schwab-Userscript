import { ui_createElement } from "frontend/components/core/createElement";
import { DS_TYPOGRAPHY, DS_COLORS } from "frontend/components/core/theme";
import type { MonitorController } from "../monitor/MonitorController";
import type { OptionCapture } from "backend/core/db/capture/optionMonitorTypes";
import { readOptionCaptures } from "../monitor/monitorCapture";
import {
  DEFAULT_MONITOR_SETTINGS,
  type MonitorSelectedExpiry,
  type MonitorUniverseMode,
} from "../monitor/monitorSettings";

type CardRefs = {
  card: HTMLElement;
  dot: HTMLElement;
  price: HTMLElement;
  time: HTMLElement;
  qBadge: HTMLElement;
  dataBadge: HTMLElement;
  topNRow: HTMLElement;
  topNInput: HTMLInputElement;
  selectedDatesRow: HTMLElement;
};

export class TickerGridManager {
  private readonly mc: MonitorController | undefined;
  private readonly gridContainer: HTMLElement;
  private draggedSymbol: string | null = null;
  private draggedCard: HTMLElement | null = null;
  private dropTargetCard: HTMLElement | null = null;
  private readonly cardMap = new Map<string, CardRefs>();
  private gridGeneration = 0;

  constructor(mc: MonitorController | undefined, gridContainer: HTMLElement) {
    this.mc = mc;
    this.gridContainer = gridContainer;
  }

  async refreshStatusGrid(): Promise<void> {
    const gen = ++this.gridGeneration;
    const symbols = this.mc?.getSymbols() ?? [];
    this.syncGridCards(symbols);

    for (const sym of symbols) {
      const refs = this.cardMap.get(sym);
      if (!refs) continue;
      const cached = this.mc?.getLatestResponse(sym) ?? null;
      const openings = await readOptionCaptures(sym);
      if (gen !== this.gridGeneration) return;
      this.updateCard(sym, refs, cached, openings);
    }
  }

  private buildCard(sym: string, isFirst: boolean): CardRefs {
    const card = ui_createElement("div", {
      styleString:
        "padding: 10px 12px; border: 1px solid rgba(60,60,67,0.14); border-radius: 10px;" +
        " background: rgba(255,255,255,0.92); cursor: grab; user-select: none; transition: all 0.15s;" +
        (isFirst
          ? " border-color: rgba(0,122,255,0.35); background: rgba(0,122,255,0.05);"
          : ""),
      props: { draggable: "true" },
    });
    card.setAttribute("data-symbol", sym);

    const headerRow = ui_createElement("div", {
      styleString:
        "display: flex; align-items: center; gap: 6px; margin-bottom: 4px;",
    });
    const dot = ui_createElement("span", {
      styleString:
        "width: 7px; height: 7px; border-radius: 50%; display: inline-block; background: #8e8e93;",
    });
    headerRow.appendChild(dot);

    if (isFirst) {
      headerRow.appendChild(
        ui_createElement("span", {
          text: "1st",
          styleString:
            "font-size: 9px; font-weight: 700; padding: 1px 4px; border-radius: 4px;" +
            " background: var(--ios-blue, #007AFF); color: #fff;",
        }),
      );
    }

    headerRow.appendChild(
      ui_createElement("span", {
        text: sym,
        styleString: DS_TYPOGRAPHY.heading + " flex: 1;",
      }),
    );

    const mc = this.mc;
    const removeBtn = ui_createElement("span", {
      text: "\u00d7",
      styleString:
        "cursor: pointer; font-size: 13px; font-weight: 700; color: var(--ios-text-secondary);" +
        " line-height: 1; opacity: 0.45; transition: opacity 0.15s;",
      events: {
        click: (e) => {
          (e as Event).stopPropagation();
          if (!mc) return;
          const current = [...mc.getSymbols()];
          const idx = current.indexOf(sym);
          if (idx >= 0) {
            current.splice(idx, 1);
            mc.updateSettings({ symbols: current });
            void mc.purgeSymbol(sym);
            void this.refreshStatusGrid();
          }
        },
        mouseenter: () => {
          removeBtn.style.opacity = "1";
          removeBtn.style.color = "#d73126";
        },
        mouseleave: () => {
          removeBtn.style.opacity = "0.4";
          removeBtn.style.color = "var(--ios-text-secondary)";
        },
      },
    });
    headerRow.appendChild(removeBtn);
    card.appendChild(headerRow);

    const price = ui_createElement("div", {
      text: "--",
      styleString:
        "font-size: 15px; font-weight: 700; color: var(--ios-text-primary); margin-bottom: 2px;",
    });
    card.appendChild(price);

    const time = ui_createElement("div", {
      text: "No data",
      styleString: "font-size: 10px; color: var(--ios-text-secondary);",
    });
    card.appendChild(time);

    const badgeRow = ui_createElement("div", {
      styleString:
        "display: flex; align-items: center; gap: 4px; margin-top: 4px; flex-wrap: wrap;",
    });
    const qBadge = ui_createElement("span", {
      styleString:
        "display: none; font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 4px; color: #fff;",
    });
    badgeRow.appendChild(qBadge);
    const dataBadge = ui_createElement("span", {
      text: "0 pts",
      styleString:
        "display: inline-block; font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 4px; background: #5856d6; color: #fff;",
    });
    badgeRow.appendChild(dataBadge);
    card.appendChild(badgeRow);

    const topNRow = ui_createElement("div", {
      styleString:
        "display: none; align-items: center; gap: 6px; margin-top: 6px;",
    });
    topNRow.appendChild(
      ui_createElement("span", {
        text: "Top N",
        styleString:
          "font-size: 11px; font-weight: 600; color: var(--ios-text-secondary);",
      }),
    );
    const topNInput = document.createElement("input");
    topNInput.type = "number";
    topNInput.min = "1";
    topNInput.max = "30";
    topNInput.value = String(
      mc?.getTopNForSymbol(sym) ?? DEFAULT_MONITOR_SETTINGS.defaultTopN,
    );
    topNInput.style.cssText =
      "width: 56px; padding: 3px 6px; font-size: 12px; border: 1px solid var(--ios-border);" +
      " border-radius: 6px; outline: none; font-family: var(--ios-font, inherit); background: rgba(255,255,255,0.95); text-align: center;";
    topNInput.addEventListener("change", () => {
      if (!mc) return;
      const next = Number.parseInt(topNInput.value, 10);
      if (!Number.isFinite(next)) {
        topNInput.value = String(mc.getTopNForSymbol(sym));
        return;
      }
      const bounded = Math.max(1, Math.min(30, Math.trunc(next)));
      topNInput.value = String(bounded);
      const topNBySymbol = { ...mc.getSettings().topNBySymbol, [sym]: bounded };
      mc.updateSettings({ topNBySymbol });
      if (mc.getSettings().universeMode === "top_n") {
        void mc.refreshSymbol(sym).finally(() => {
          void this.refreshStatusGrid();
        });
      }
    });
    topNRow.appendChild(topNInput);
    card.appendChild(topNRow);

    const selectedDatesRow = ui_createElement("div", {
      styleString:
        "display: none; margin-top: 6px; font-size: 11px; line-height: 1.4;" +
        " color: var(--ios-text-secondary);",
    });
    card.appendChild(selectedDatesRow);

    // Drag events
    card.addEventListener("dragstart", (e) => {
      this.draggedSymbol = sym;
      this.draggedCard = card;
      card.style.opacity = "0.4";
      (e as DragEvent).dataTransfer?.setData("text/plain", sym);
    });
    card.addEventListener("dragend", () => {
      card.style.opacity = "1";
      this.draggedSymbol = null;
      this.draggedCard = null;
      if (this.dropTargetCard) {
        this.dropTargetCard.style.boxShadow = "";
        this.dropTargetCard = null;
      }
    });
    card.addEventListener("dragover", (e) => {
      (e as DragEvent).preventDefault();
      if (this.draggedCard === card) return;
      if (this.dropTargetCard && this.dropTargetCard !== card) {
        this.dropTargetCard.style.boxShadow = "";
      }
      this.dropTargetCard = card;
      card.style.boxShadow = "inset 3px 0 0 var(--ios-blue, #007AFF)";
    });
    card.addEventListener("dragleave", () => {
      if (this.dropTargetCard === card) {
        card.style.boxShadow = "";
        this.dropTargetCard = null;
      }
    });
    card.addEventListener("drop", (e) => {
      (e as DragEvent).preventDefault();
      card.style.boxShadow = "";
      this.dropTargetCard = null;
      if (!mc || !this.draggedSymbol || this.draggedSymbol === sym) return;
      const current = [...mc.getSymbols()];
      const fromIdx = current.indexOf(this.draggedSymbol);
      const toIdx = current.indexOf(sym);
      if (fromIdx < 0 || toIdx < 0) return;
      current.splice(fromIdx, 1);
      current.splice(toIdx, 0, this.draggedSymbol);
      mc.updateSettings({ symbols: current });
      void this.refreshStatusGrid();
    });

    return {
      card,
      dot,
      price,
      time,
      qBadge,
      dataBadge,
      topNRow,
      topNInput,
      selectedDatesRow,
    };
  }

  private syncGridCards(symbols: readonly string[]): void {
    const currentKeys = [...this.cardMap.keys()];
    const same =
      symbols.length === currentKeys.length &&
      symbols.every((s, i) => s === currentKeys[i]);
    if (same) return;

    this.cardMap.clear();
    this.gridContainer.innerHTML = "";
    for (let i = 0; i < symbols.length; i++) {
      const refs = this.buildCard(symbols[i], i === 0);
      this.cardMap.set(symbols[i], refs);
      this.gridContainer.appendChild(refs.card);
    }
  }

  private updateCard(
    sym: string,
    refs: CardRefs,
    cached: any,
    openings: OptionCapture[],
  ): void {
    const mc = this.mc;
    const latestOpening = openings.length > 0 ? openings[0] : null;

    refs.dot.style.background = cached ? "#34c759" : "#8e8e93";

    const price =
      cached?.underlyingPrice ?? latestOpening?.underlyingPrice ?? null;
    refs.price.textContent = price != null ? `$${price.toFixed(2)}` : "--";

    const capturedAt = mc?.getLatestCapturedAt(sym) ?? null;
    const lastTs = capturedAt ?? latestOpening?.capturedAt ?? null;
    refs.time.textContent = lastTs ? formatTime(lastTs) : "No data";

    if (latestOpening) {
      refs.qBadge.textContent = `Q: ${latestOpening.qualityGrade} (${latestOpening.qualityScore.toFixed(0)}%)`;
      refs.qBadge.style.background = qualityColor(latestOpening.qualityScore);
      refs.qBadge.style.display = "inline-block";
    } else {
      refs.qBadge.style.display = "none";
    }

    refs.dataBadge.textContent = `${openings.length} pts`;

    const currentMode =
      mc?.getSettings().universeMode ?? DEFAULT_MONITOR_SETTINGS.universeMode;
    const isTopNMode = currentMode === "top_n";
    refs.topNRow.style.display = isTopNMode ? "flex" : "none";
    if (isTopNMode)
      refs.topNInput.value = String(
        mc?.getTopNForSymbol(sym) ?? DEFAULT_MONITOR_SETTINGS.defaultTopN,
      );

    const isScopedMode =
      currentMode === "top_n" || currentMode === "fixed_slots";
    const selectedExpiries = mc?.getSelectedExpiries(sym) ?? [];
    if (isScopedMode) {
      refs.selectedDatesRow.style.display = "block";
      refs.selectedDatesRow.textContent =
        selectedExpiries.length > 0
          ? `Selected: ${formatSelectedExpiries(currentMode, selectedExpiries)}`
          : "Selected: waiting initial fetch...";
    } else {
      refs.selectedDatesRow.style.display = "none";
      refs.selectedDatesRow.textContent = "";
    }
  }
}

export function modeLabelText(mode: MonitorUniverseMode): string {
  if (mode === "top_n") return "Top N Expiries";
  if (mode === "fixed_slots") return "Fixed Key Slots";
  return "All Expiries (Full Chain)";
}

function formatSelectedExpiries(
  mode: MonitorUniverseMode,
  items: readonly MonitorSelectedExpiry[],
): string {
  const sortedByDate = [...items].sort(compareSelectedByDateAsc);
  if (mode === "top_n") {
    return sortedByDate
      .map((item) => compactRequestDate(item.requestDate))
      .join(", ");
  }
  return sortedByDate
    .map(
      (item) =>
        `${fixedSlotLabel(item.slot)} ${compactRequestDate(item.requestDate)}`,
    )
    .join(" | ");
}

function compareSelectedByDateAsc(
  a: MonitorSelectedExpiry,
  b: MonitorSelectedExpiry,
): number {
  const aDate = parseRequestDate(a.requestDate);
  const bDate = parseRequestDate(b.requestDate);
  if (aDate && bDate) {
    if (aDate.year !== bDate.year) return aDate.year - bDate.year;
    if (aDate.month !== bDate.month) return aDate.month - bDate.month;
    if (aDate.day !== bDate.day) return aDate.day - bDate.day;
  } else if (aDate) {
    return -1;
  } else if (bDate) {
    return 1;
  }
  return (
    (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER)
  );
}

function parseRequestDate(
  requestDate: string,
): { year: number; month: number; day: number } | null {
  const parts = requestDate.split("/");
  if (parts.length !== 3) return null;
  const month = Number.parseInt(parts[0], 10);
  const day = Number.parseInt(parts[1], 10);
  const year = Number.parseInt(parts[2], 10);
  if (
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(year)
  )
    return null;
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900)
    return null;
  return { year, month, day };
}

function compactRequestDate(requestDate: string): string {
  const parts = requestDate.split("/");
  if (parts.length !== 3) return requestDate;
  return `${parts[0]}/${parts[1]}`;
}

function fixedSlotLabel(slot: MonitorSelectedExpiry["slot"]): string {
  if (slot === "0dte") return "0DTE";
  if (slot === "this_week") return "ThisW";
  if (slot === "next_week") return "NextW";
  if (slot === "month_end") return "MEnd";
  if (slot === "quarter_end") return "QEnd";
  if (slot === "year_end") return "YEnd";
  if (slot === "leap") return "LEAP";
  return "Slot";
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleTimeString("en-US", {
      timeZone: "America/Chicago",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

function qualityColor(score: number): string {
  if (score >= 80) return DS_COLORS.raw.positive;
  if (score >= 60) return DS_COLORS.raw.neutral;
  return DS_COLORS.raw.negative;
}

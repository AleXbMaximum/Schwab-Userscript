import { DS_COLORS } from "../components/core/styles/theme";
import type { OptionsChainsResponse } from "shared/types/options";
import type { OptionsStore } from "./store/OptionsViewStore";
import type {
  SavedViewState,
  TimestampSavedView,
} from "./savedView/savedViewTypes";
import { formatTimeLabel } from "./savedView/savedViewSerializer";
import {
  readTimestampSavedViews,
  writeTimestampSavedViews,
} from "./savedView/savedViewRepository";
import { clearFocusedStrike } from "./focus/focusStrike";

export type TimestampActionContext = {
  store: OptionsStore;
  statusLabel: HTMLElement;
  symbolInput: HTMLInputElement;
  getCurrentSymbol: () => string;
  buildSavedViewState: () => SavedViewState;
  renderTickerSelect: (symbolOverride?: string) => void;
  applySavedViewState: (
    view: SavedViewState,
    response: OptionsChainsResponse,
  ) => void;
  renderCharts: () => void;
};

export async function handleSaveTimestamp(
  ctx: TimestampActionContext,
): Promise<void> {
  const { store, statusLabel, getCurrentSymbol, buildSavedViewState } = ctx;
  const state = store.getState();
  if (!state.response) {
    statusLabel.textContent = "Load data first before saving timestamp.";
    statusLabel.style.color = DS_COLORS.negative;
    return;
  }

  const symbol = (state.response.underlying.symbol || getCurrentSymbol())
    .trim()
    .toUpperCase();
  if (!symbol) {
    statusLabel.textContent = "Missing symbol; cannot save timestamp view.";
    statusLabel.style.color = DS_COLORS.negative;
    return;
  }

  const savedView: TimestampSavedView = {
    version: 1,
    symbol,
    savedAt: new Date().toISOString(),
    dataTimestamp:
      state.response.currentDateTime ||
      state.timestamp ||
      new Date().toISOString(),
    response: state.response,
    view: buildSavedViewState(),
  };

  try {
    const existing = await readTimestampSavedViews(symbol);
    const merged = [
      savedView,
      ...existing.filter(
        (s) => s.dataTimestamp !== savedView.dataTimestamp,
      ),
    ];
    await writeTimestampSavedViews(symbol, merged);
    statusLabel.textContent = `Saved timestamp ${formatTimeLabel(savedView.dataTimestamp)} (${symbol}).`;
    statusLabel.style.color = "var(--ios-text-secondary)";
  } catch (err) {
    statusLabel.textContent = `Save timestamp failed: ${(err as Error)?.message ?? "unknown error"}`;
    statusLabel.style.color = DS_COLORS.negative;
  }
}

export async function handleLoadTimestamp(
  ctx: TimestampActionContext,
): Promise<void> {
  const {
    store,
    statusLabel,
    symbolInput,
    getCurrentSymbol,
    renderTickerSelect,
    applySavedViewState,
    renderCharts,
  } = ctx;

  const symbol = getCurrentSymbol();
  if (!symbol) {
    statusLabel.textContent = "Enter/load a symbol first.";
    statusLabel.style.color = DS_COLORS.negative;
    return;
  }

  const savedViews = await readTimestampSavedViews(symbol);
  if (savedViews.length === 0) {
    statusLabel.textContent = `No saved timestamps for ${symbol}.`;
    statusLabel.style.color = DS_COLORS.negative;
    return;
  }

  const maxChoices = Math.min(12, savedViews.length);
  const options = savedViews
    .slice(0, maxChoices)
    .map(
      (s, i) =>
        `${i + 1}. data=${formatTimeLabel(s.dataTimestamp)} | saved=${formatTimeLabel(s.savedAt)}`,
    )
    .join("\n");
  const choice = window.prompt(
    `Load saved timestamp for ${symbol}:\n${options}\nEnter 1-${maxChoices}`,
    "1",
  );
  if (choice == null) return;
  const index = Number(choice) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= maxChoices) {
    statusLabel.textContent = "Invalid timestamp selection.";
    statusLabel.style.color = DS_COLORS.negative;
    return;
  }

  const selected = savedViews[index];
  try {
    clearFocusedStrike();
    symbolInput.value = symbol;
    renderTickerSelect(symbol);
    store.setState({
      response: selected.response,
      timestamp: selected.dataTimestamp || new Date().toISOString(),
    });
    applySavedViewState(selected.view, selected.response);
    renderCharts();
    statusLabel.textContent = `Loaded timestamp ${formatTimeLabel(selected.dataTimestamp)} (${symbol}).`;
    statusLabel.style.color = "var(--ios-text-secondary)";
  } catch (err) {
    statusLabel.textContent = `Load timestamp failed: ${(err as Error)?.message ?? "unknown error"}`;
    statusLabel.style.color = DS_COLORS.negative;
  }
}

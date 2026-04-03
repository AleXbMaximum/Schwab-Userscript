import type { DashboardState, DashboardSymbol } from "./types";
import { CAPTURE_WINDOW_MIN, CAPTURE_WINDOW_MAX } from "./types";
import { getTodayDateCT } from "shared/utils/time";
import { logService } from "shared/log/core/LogService";

const log = logService.namespace("storage");

export type DashboardListener = (state: DashboardState) => void;

export interface DashboardStore {
  getState(): DashboardState;
  setSymbol(symbol: DashboardSymbol): void;
  setDateRange(dateStart: string, dateEnd: string): void;
  setTimeWindow(startMin: number, endMin: number): void;
  setLoading(loading: boolean): void;
  setError(error: string | null): void;
  update(patch: Partial<DashboardState>): void;
  subscribe(listener: DashboardListener): () => void;
}

export function createDashboardStore(
  initialSymbol?: DashboardSymbol,
): DashboardStore {
  const today = getTodayDateCT();
  let state: DashboardState = {
    symbol: initialSymbol || "SPY",
    dateStart: today,
    dateEnd: today,
    timeStartMin: CAPTURE_WINDOW_MIN,
    timeEndMin: CAPTURE_WINDOW_MAX,
    loading: false,
    error: null,
    metaRows: [],
    expiryRows: [],
  };

  const listeners = new Set<DashboardListener>();

  function notify(): void {
    for (const fn of listeners) {
      try {
        fn(state);
      } catch (e) {
        log.warn("store.listener.error", {
          error: (e as Error)?.message ?? String(e),
        });
      }
    }
  }

  return {
    getState: () => state,

    setSymbol(symbol: DashboardSymbol) {
      state = { ...state, symbol };
      notify();
    },

    setDateRange(dateStart: string, dateEnd: string) {
      state = { ...state, dateStart, dateEnd };
      notify();
    },

    setTimeWindow(startMin: number, endMin: number) {
      state = { ...state, timeStartMin: startMin, timeEndMin: endMin };
      notify();
    },

    setLoading(loading: boolean) {
      state = { ...state, loading };
      notify();
    },

    setError(error: string | null) {
      state = { ...state, error };
      notify();
    },

    update(patch: Partial<DashboardState>) {
      state = { ...state, ...patch };
      notify();
    },

    subscribe(listener: DashboardListener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

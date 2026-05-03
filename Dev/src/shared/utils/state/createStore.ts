/**
 * Generic store factory with optional synchronous derive.
 *
 * `derive` runs inside `setState` BEFORE listeners are notified,
 * so subscribers always see the fully-derived state.
 */

export type StoreListener<S> = (state: S, prev: S) => void;

export type Store<S> = {
  getState: () => S;
  setState: (patch: Partial<S>) => void;
  subscribe: (fn: StoreListener<S>) => () => void;
};

export function createStore<S extends object>(
  initial: S,
  options?: { derive?: (state: S, prev: S) => Partial<S> },
): Store<S> {
  let state: S = initial;
  const listeners = new Set<StoreListener<S>>();

  return {
    getState: () => state,

    setState(patch: Partial<S>) {
      const prev = state;
      state = { ...state, ...patch };

      if (options?.derive) {
        const derived = options.derive(state, prev);
        state = { ...state, ...derived };
      }

      for (const fn of listeners) {
        fn(state, prev);
      }
    },

    subscribe(fn: StoreListener<S>) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };
}

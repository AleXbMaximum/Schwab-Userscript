// Shared cleanup accumulator — standardizes the cleanup pattern across pages.
// Wraps each cleanup call in try-catch to prevent cascade failures.

export type CleanupFn = () => void;

export function createCleanupAccumulator() {
  const fns: CleanupFn[] = [];
  return {
    /** Register a cleanup function to run on teardown. */
    add(fn: CleanupFn): void {
      fns.push(fn);
    },
    /** Run all registered cleanups (safe: one failure does not block others). */
    run(): void {
      for (const fn of fns) {
        try {
          fn();
        } catch (e) {
          console.warn("[cleanup]", e);
        }
      }
      fns.length = 0;
    },
  };
}

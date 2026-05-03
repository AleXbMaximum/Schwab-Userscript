export interface Clock {
  now(): number;
  setTimeout(
    callback: (...args: any[]) => void,
    delay: number,
  ): ReturnType<typeof setTimeout>;
  clearTimeout(timeoutId: ReturnType<typeof setTimeout>): void;
}

export const systemClock: Clock = {
  now: () => Date.now(),
  setTimeout: (cb, delay) => setTimeout(cb, delay),
  clearTimeout: (id) => clearTimeout(id),
};

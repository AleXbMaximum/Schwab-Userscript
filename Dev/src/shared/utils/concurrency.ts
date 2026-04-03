/** Run async work over a queue of items with a concurrency limit. */
export async function runConcurrentQueue<T>(
  items: string[],
  fn: (item: string) => Promise<T>,
  concurrency: number,
  onError?: (item: string, err: Error) => void,
): Promise<Map<string, T>> {
  const results = new Map<string, T>();
  const queue = [...items];

  const worker = async () => {
    while (queue.length > 0) {
      const item = queue.shift()!;
      try {
        results.set(item, await fn(item));
      } catch (err) {
        onError?.(item, err as Error);
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

/**
 * Reusable SSE line parser. Reads a streaming Response body and yields
 * each `data:` payload as a raw string. Handles:
 * - Incomplete line buffering across chunks
 * - `[DONE]` sentinel (OpenAI convention)
 * - Decoder flush on stream end
 * - AbortSignal for cancellation
 */
export async function* parseSSEStream(
  response: Response,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  if (!response.body) throw new Error("SSE response body is empty");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      if (signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();
          if (data === "[DONE]") return;
          if (data) yield data;
        }
      }
    }
    // Flush remaining
    buffer += decoder.decode();
    for (const line of buffer.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("data: ")) {
        const data = trimmed.slice(6).trim();
        if (data && data !== "[DONE]") yield data;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

import type { LLMClient } from "../../../core/network/llm/LLMClient";
import type {
  AIAgentRole,
  AIAnalysisRecord,
  AIAnalysisState,
  AIProgressCallback,
  AIStageResult,
  AIStreamCallback,
  AIToolName,
  Citation,
  LLMMessage,
} from "../types";
import { parseToolCall, stripToolCallTag } from "../pipeline/parsers";

export interface AgentRunArgs {
  record: AIAnalysisRecord;
  state: AIAnalysisState;
  onProgress: AIProgressCallback;
  role: AIAgentRole;
  labelOverride?: string;
  systemPrompt: string;
  initialUserContent: string;
  targetProgress: number;
  enableTools: boolean;
  toolExecutor: Record<AIToolName, () => Promise<string>>;
  maxIter: number;
  client: LLMClient;
  temperatureOverride?: number;
  onStream?: AIStreamCallback;
  webSearch?: boolean;
  signal?: AbortSignal;
}

/**
 * Generic ReAct/tool-loop runner used by every agent phase.
 * Behavior preserved verbatim from the previous AIOrchestrator method:
 *   - Streams only on the final (non-tool) iteration when an onStream callback is provided.
 *   - Tool calls iterate up to `maxIter` times; an iteration without a tool call ends the loop.
 *   - Mutates `record.totalTokensUsed` and `state.stages` to reflect progress.
 */
export async function runAgentWithTools(
  args: AgentRunArgs,
): Promise<AIStageResult> {
  const {
    record,
    state,
    onProgress,
    role,
    labelOverride,
    systemPrompt,
    initialUserContent,
    targetProgress,
    enableTools,
    toolExecutor,
    maxIter,
    client,
    temperatureOverride,
    onStream,
    webSearch,
    signal,
  } = args;

  const result: AIStageResult = {
    role,
    label: labelOverride,
    status: "running",
    content: "",
    toolCallsMade: 0,
  };
  const startMs = Date.now();

  state.stages = [
    ...state.stages.filter(
      (s) => !(s.role === role && s.label === labelOverride),
    ),
    result,
  ];
  onProgress({ ...state });

  try {
    const messages: LLMMessage[] = [
      { role: "user", content: initialUserContent },
    ];
    let lastContent = "";
    let totalTokens = 0;
    let toolCallsMade = 0;
    let thinkingContent = "";
    const citations: Citation[] = [];

    const iterLimit = enableTools ? Math.max(1, maxIter) : 1;

    for (let iter = 0; iter < iterLimit; iter++) {
      const isLastIteration = !enableTools || iter >= iterLimit - 1;
      const shouldStream = isLastIteration && onStream != null;

      if (shouldStream) {
        let accumulated = "";
        let thinkingAccumulated = "";

        for await (const chunk of client.completeStream({
          messages,
          systemPrompt,
          ...(temperatureOverride != null
            ? { temperature: temperatureOverride }
            : {}),
          webSearch,
          signal,
        })) {
          if (chunk.type === "text") {
            accumulated += chunk.delta ?? "";
            onStream({
              type: "stage_text",
              role,
              label: labelOverride,
              delta: chunk.delta ?? "",
              accumulated,
            });
          } else if (chunk.type === "thinking") {
            thinkingAccumulated += chunk.delta ?? "";
            onStream({
              type: "stage_thinking",
              role,
              label: labelOverride,
              delta: chunk.delta ?? "",
              accumulated: thinkingAccumulated,
            });
          } else if (chunk.type === "annotation" && chunk.annotation) {
            citations.push(chunk.annotation);
            onStream({
              type: "stage_annotation",
              role,
              label: labelOverride,
              annotation: chunk.annotation,
            });
          } else if (chunk.type === "done") {
            totalTokens += chunk.tokensUsed ?? 0;
          } else if (chunk.type === "error") {
            throw new Error(chunk.error ?? "Stream error");
          }
        }

        lastContent = accumulated;
        thinkingContent = thinkingAccumulated;
        onStream({ type: "stage_done", role, label: labelOverride });
        break;
      } else {
        const response = await client.complete({
          messages,
          systemPrompt,
          ...(temperatureOverride != null
            ? { temperature: temperatureOverride }
            : {}),
        });
        lastContent = response.content;
        totalTokens += response.tokensUsed;

        if (!enableTools || iter >= iterLimit - 1) break;

        const toolCall = parseToolCall(response.content);
        if (!toolCall) break;

        const executor = toolExecutor[toolCall.name];
        if (!executor) break;

        let toolResult: string;
        try {
          toolResult = await executor();
        } catch (toolErr) {
          toolResult = `Error fetching ${toolCall.name}: ${String(toolErr)}`;
        }
        toolCallsMade++;

        messages.push({ role: "assistant", content: response.content });
        messages.push({
          role: "user",
          content: `Tool result for ${toolCall.name}:\n\n${toolResult}\n\nPlease complete your analysis incorporating this additional data.`,
        });
      }
    }

    result.content = stripToolCallTag(lastContent);
    result.tokensUsed = totalTokens;
    result.toolCallsMade = toolCallsMade;
    result.status = "done";
    result.systemPrompt = systemPrompt;
    result.inputMessages = [...messages];
    if (thinkingContent) result.thinkingContent = thinkingContent;
    if (citations.length > 0) result.citations = citations;
  } catch (err) {
    result.status = "error";
    result.errorMessage = err instanceof Error ? err.message : String(err);
    // Don't rethrow — let pipeline continue
  }

  result.durationMs = Date.now() - startMs;
  record.totalTokensUsed =
    (record.totalTokensUsed ?? 0) + (result.tokensUsed ?? 0);

  state.stages = [
    ...state.stages.filter(
      (s) => !(s.role === role && s.label === labelOverride),
    ),
    result,
  ];
  state.progress = targetProgress;
  onProgress({ ...state });

  return result;
}

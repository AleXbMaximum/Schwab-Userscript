import type { DataFetcher } from "./DataFetcher";
import type { MemoryStore } from "../../../core/db/ai/MemoryStore";
import type { AIToolName, MarketDataBundle } from "../types";
import { computeOHLCVFeatures } from "./technicals";
import { validateAndFlag, formatDataQualityBlock } from "./dataPreprocessing";
import { evaluateDataCompleteness } from "./parsers";
import { formatMemoryContext, formatOHLCVFeatures } from "./formatters";
import { buildToolExecutor } from "../tools/toolExecutor";
import { buildAnalystsContext } from "./contextBuilders";

export interface AIPipelineBundle {
  ctx: ReturnType<typeof buildAnalystsContext>;
  memoryCtx: string;
  dqBlock: string;
  dataWarningBlock: string;
  featureCtx: string;
  toolExecutor: Record<AIToolName, () => Promise<string>>;
}

/**
 * Build the per-run bundle of context strings + tool executor that all
 * downstream phases consume. Idempotent and side-effect-free apart from the
 * memory-store read.
 */
export async function prepareBundle(args: {
  symbol: string;
  marketData: MarketDataBundle;
  fetcher: DataFetcher;
  memoryStore: MemoryStore | null;
  enableMemory: boolean;
}): Promise<AIPipelineBundle> {
  const { symbol, marketData, fetcher, memoryStore, enableMemory } = args;

  let memoryCtx = "";
  if (enableMemory && memoryStore) {
    try {
      const memories = await memoryStore.getRecentForSymbol(symbol, 3);
      if (memories.length > 0) memoryCtx = formatMemoryContext(memories);
    } catch {
      // non-critical — memory absence is recoverable
    }
  }

  const ctx = buildAnalystsContext(symbol, marketData);

  const dataQuality = validateAndFlag(marketData);
  const dqBlock = formatDataQualityBlock(dataQuality);

  const dataCompleteness = evaluateDataCompleteness(marketData);
  const dataWarningBlock = dataCompleteness.criticalMissing
    ? `\n## DATA_INTEGRITY_WARNING\nCritical fundamentals missing: ${dataCompleteness.missingFields.join(", ")}. No financial statements available. Output only a DATA_GAP block — do not write narrative.\n\n`
    : dataCompleteness.missingFields.length > 0
      ? `\n## DATA_NOTE\nPartially missing fields: ${dataCompleteness.missingFields.join(", ")}. Note gaps inline and continue analysis.\n\n`
      : "";

  const ohlcvFeatures = computeOHLCVFeatures(marketData.ohlcv90d);
  const featureCtx = formatOHLCVFeatures(
    ohlcvFeatures,
    marketData.currentPrice,
  );

  const toolExecutor = buildToolExecutor(symbol, marketData, fetcher);

  return { ctx, memoryCtx, dqBlock, dataWarningBlock, featureCtx, toolExecutor };
}

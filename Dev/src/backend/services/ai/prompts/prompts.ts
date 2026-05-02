import { MARKET_ANALYST } from "./agents/marketAnalyst";
import { TECHNICALS_ANALYST } from "./agents/technicalsAnalyst";
import { FUNDAMENTALS_ANALYST } from "./agents/fundamentalsAnalyst";
import { FINANCIAL_QUALITY_ANALYST } from "./agents/financialQualityAnalyst";
import { SENTIMENT_COMPANY } from "./agents/sentimentCompany";
import { SENTIMENT_MACRO } from "./agents/sentimentMacro";
import { SELLSIDE_ANALYST } from "./agents/sellsideAnalyst";
import { OWNERSHIP_ANALYST } from "./agents/ownershipAnalyst";
import { bull_debater } from "./agents/debateBull";
import { bear_debater } from "./agents/debateBear";
import { research_manager } from "./agents/researchManager";
import { TRADER } from "./agents/trader";
import { RISK_AGGRESSIVE } from "./agents/riskAggressive";
import { RISK_CONSERVATIVE } from "./agents/riskConservative";
import { RISK_NEUTRAL } from "./agents/riskNeutral";
import { risk_manager } from "./agents/riskManager";

export const PROMPTS = {
  market_analyst: MARKET_ANALYST,
  technicals_analyst: TECHNICALS_ANALYST,
  fundamentals_analyst: FUNDAMENTALS_ANALYST,
  financial_quality_analyst: FINANCIAL_QUALITY_ANALYST,
  sentiment_company: SENTIMENT_COMPANY,
  sentiment_macro: SENTIMENT_MACRO,
  sellside_analyst: SELLSIDE_ANALYST,
  ownership_analyst: OWNERSHIP_ANALYST,
  bull_debater,
  bear_debater,
  research_manager,
  trader: TRADER,
  risk_analyst_aggressive: RISK_AGGRESSIVE,
  risk_analyst_conservative: RISK_CONSERVATIVE,
  risk_analyst_neutral: RISK_NEUTRAL,
  risk_manager,
} as const;

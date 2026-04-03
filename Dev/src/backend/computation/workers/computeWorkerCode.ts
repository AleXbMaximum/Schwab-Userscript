import { sharedUtilsCode } from "./computeCode/sharedUtils";
import { holdingsParserCode } from "./computeCode/holdingsParser";
import { mathHelpersCode } from "./computeCode/mathHelpers";
import { optionsParserCode } from "./computeCode/optionsParser";
import { chainHelpersCode } from "./computeCode/chainHelpers";
import { gexComputeCode } from "./computeCode/gexCompute";
import { volatilityComputeCode } from "./computeCode/volatilityCompute";
import { distributionComputeCode } from "./computeCode/distributionCompute";
import { expectedMoveComputeCode } from "./computeCode/expectedMoveCompute";
import { qualityComputeCode } from "./computeCode/qualityCompute";
import { summaryComputeCode } from "./computeCode/summaryCompute";
import { expiryUtilsCode } from "./computeCode/expiryUtils";
import { etlOrchestratorCode } from "./computeCode/etlOrchestrator";
import { quotesParserCode } from "./computeCode/quotesParser";
import { betaComputeCode } from "./computeCode/betaCompute";
import { bsMathCode } from "./computeCode/bsMath";
import { messageHandlerCode } from "./computeCode/messageHandler";

export const COMPUTE_WORKER_CODE = [
  '"use strict";',
  sharedUtilsCode,
  mathHelpersCode,
  holdingsParserCode,
  optionsParserCode,
  chainHelpersCode,
  bsMathCode,
  gexComputeCode,
  volatilityComputeCode,
  distributionComputeCode,
  expectedMoveComputeCode,
  qualityComputeCode,
  summaryComputeCode,
  expiryUtilsCode,
  etlOrchestratorCode,
  quotesParserCode,
  betaComputeCode,
  messageHandlerCode,
].join("\n");

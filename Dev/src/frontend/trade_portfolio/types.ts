export type PortfolioSectionId =
  | "overview"
  | "exposure"
  | "scenarios"
  | "governance";

export type PortfolioCardSpan = 1 | 2 | 3;

export type PortfolioCardNature = "chart" | "text" | "interactive";

export type PortfolioFocusMode = "all" | "breaches" | "stress";

export type PortfolioSeverityFilter = "all" | "critical" | "warning";

export type ScenarioModelType = "anchor" | "threeFactor";

export type PortfolioControlState = {
  paused: boolean;
  focusMode: PortfolioFocusMode;
  severityFilter: PortfolioSeverityFilter;
  riskAppetite: number;
  scenarioModelType: ScenarioModelType;
  scenarioHorizon: "ultraShort" | "short" | "medium" | "long";
};

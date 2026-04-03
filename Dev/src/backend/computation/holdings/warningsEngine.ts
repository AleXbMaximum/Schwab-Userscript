import type{
  DerivedState,
  HoldingsKey,
  UnderlyingKey,
  WarningCell,
  WarningHit,
  WarningLevel,
  WarningRuleConfig,
  WarningRuleScope,
  WarningState,
} from "shared/types/derived";
import { isFiniteNumber } from "shared/utils/math/guards";

type ParsedRulesDoc = {
  version?: number;
  rules?: unknown;
};

const levelRank: Record<WarningLevel, number> = {
  none: 0,
  info: 1,
  warn: 2,
  critical: 3,
};

function coerceRules(json: string | null): WarningRuleConfig[] {
  if (!json) return [];
  const doc = JSON.parse(json) as ParsedRulesDoc;
  const rawRules = (doc as any)?.rules;
  if (!Array.isArray(rawRules)) return [];

  const rules: WarningRuleConfig[] = [];
  for (const item of rawRules) {
    if (!item || typeof item !== "object") continue;
    const r = item as any;
    if (typeof r.id !== "string" || !r.id.trim()) continue;
    if (typeof r.metric !== "string" || !r.metric.trim()) continue;
    const scope = r.scope as WarningRuleScope;
    if (scope !== "HOLDING" && scope !== "UNDERLYING" && scope !== "PORTFOLIO")
      continue;

    rules.push({
      id: r.id.trim(),
      name: typeof r.name === "string" ? r.name : undefined,
      scope,
      cadence: r.cadence,
      metric: r.metric.trim(),
      warnAbove: typeof r.warnAbove === "number" ? r.warnAbove : undefined,
      criticalAbove:
        typeof r.criticalAbove === "number" ? r.criticalAbove : undefined,
      warnBelow: typeof r.warnBelow === "number" ? r.warnBelow : undefined,
      criticalBelow:
        typeof r.criticalBelow === "number" ? r.criticalBelow : undefined,
      message: typeof r.message === "string" ? r.message : undefined,
    });
  }

  return rules;
}

function getMetricValue(
  scope: WarningRuleScope,
  metric: string,
  derived: DerivedState,
  key?: string,
): number | null {
  const parts = metric
    .split(".")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;

  const root = parts[0];
  const field = parts.slice(1).join(".");

  if (scope === "HOLDING") {
    if (root !== "derived") return null;
    if (!key) return null;
    const row = derived.byHoldingsKey[key];
    const v = (row as any)?.[field];
    return isFiniteNumber(v) ? v : null;
  }

  if (scope === "UNDERLYING") {
    if (root !== "derivedUnderlying") return null;
    if (!key) return null;
    const row = derived.byUnderlying[key];
    const v = (row as any)?.[field];
    return isFiniteNumber(v) ? v : null;
  }

  if (scope === "PORTFOLIO") {
    if (root !== "portfolio") return null;
    const v = (derived.portfolioAgg as any)?.[field];
    return isFiniteNumber(v) ? v : null;
  }

  return null;
}

function evalRuleValue(
  rule: WarningRuleConfig,
  value: number | null,
): WarningLevel {
  if (value == null) return "none";

  if (rule.criticalAbove != null && value > rule.criticalAbove)
    return "critical";
  if (rule.criticalBelow != null && value < rule.criticalBelow)
    return "critical";

  if (rule.warnAbove != null && value > rule.warnAbove) return "warn";
  if (rule.warnBelow != null && value < rule.warnBelow) return "warn";

  return "none";
}

function mergeCell(base: WarningCell, incoming: WarningHit): WarningCell {
  if (levelRank[incoming.level] <= levelRank[base.level]) {
    const hits = base.hits ? [...base.hits, incoming] : [incoming];
    return { ...base, hits };
  }

  const hits = base.hits ? [...base.hits, incoming] : [incoming];
  const text = incoming.message ?? base.text;
  return { level: incoming.level, text, hits };
}

function emptyCell(): WarningCell {
  return { level: "none", text: "" };
}

export function evaluateWarningsFromJson(
  warningRulesJson: string | null,
  derived: DerivedState,
): WarningState {
  const rules = coerceRules(warningRulesJson);
  const asOfTs = Date.now();

  const byHoldingsKey: Record<HoldingsKey, WarningCell> = {};
  const byUnderlying: Record<UnderlyingKey, WarningCell> = {};
  let portfolio: WarningCell = emptyCell();

  if (!rules.length) {
    return { byHoldingsKey, byUnderlying, portfolio, asOfTs };
  }

  for (const rule of rules) {
    if (rule.scope === "HOLDING") {
      for (const pk of Object.keys(derived.byHoldingsKey)) {
        const value = getMetricValue("HOLDING", rule.metric, derived, pk);
        const level = evalRuleValue(rule, value);
        if (level === "none") continue;
        const hit: WarningHit = {
          ruleId: rule.id,
          level,
          message: rule.message ?? rule.name ?? rule.id,
          asOfTs,
        };
        byHoldingsKey[pk] = mergeCell(byHoldingsKey[pk] ?? emptyCell(), hit);
      }
    } else if (rule.scope === "UNDERLYING") {
      for (const uk of Object.keys(derived.byUnderlying)) {
        const value = getMetricValue("UNDERLYING", rule.metric, derived, uk);
        const level = evalRuleValue(rule, value);
        if (level === "none") continue;
        const hit: WarningHit = {
          ruleId: rule.id,
          level,
          message: rule.message ?? rule.name ?? rule.id,
          asOfTs,
        };
        byUnderlying[uk] = mergeCell(byUnderlying[uk] ?? emptyCell(), hit);
      }
    } else if (rule.scope === "PORTFOLIO") {
      const value = getMetricValue("PORTFOLIO", rule.metric, derived);
      const level = evalRuleValue(rule, value);
      if (level === "none") continue;
      const hit: WarningHit = {
        ruleId: rule.id,
        level,
        message: rule.message ?? rule.name ?? rule.id,
        asOfTs,
      };
      portfolio = mergeCell(portfolio, hit);
    }
  }

  for (const [pk, cell] of Object.entries(byHoldingsKey)) {
    if (!cell.text) byHoldingsKey[pk] = { ...cell, text: cell.level };
  }
  for (const [uk, cell] of Object.entries(byUnderlying)) {
    if (!cell.text) byUnderlying[uk] = { ...cell, text: cell.level };
  }
  if (!portfolio.text) portfolio = { ...portfolio, text: portfolio.level };

  return { byHoldingsKey, byUnderlying, portfolio, asOfTs };
}

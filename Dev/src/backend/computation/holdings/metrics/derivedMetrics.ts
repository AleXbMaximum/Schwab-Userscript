import type{ DerivedMetricsRow } from "../../../../shared/types/derived";
import type{ HoldingsRow } from "../../../../shared/types/holdings";
import {
  DEFAULT_OPTION_MULTIPLIER,
  getInstrumentKind,
  parseOptionContractMeta,
} from "../../../../shared/utils/domain/holdingsKeys";
import { safeDiv } from "../../../../shared/utils/math/guards";

// Pre-split path cache to avoid repeated string.split() allocations
const pathCache = new Map<string, string[]>();

// Cache parsed option contract meta per symbol (static within a session)
const optMetaCache = new Map<
  string,
  ReturnType<typeof parseOptionContractMeta>
>();

function getCachedOptMeta(
  row: HoldingsRow,
): ReturnType<typeof parseOptionContractMeta> {
  const sym = ((row as any)?.dataSymbol ?? (row as any)?.symbol?.symbol ?? "")
    .toString()
    .trim();
  if (!sym) return null;
  const cached = optMetaCache.get(sym);
  if (cached !== undefined) return cached;
  const result = parseOptionContractMeta(row);
  optMetaCache.set(sym, result);
  return result;
}

/** Clear option meta cache on holdings ingest (daily refresh). */
export function clearOptMetaCache(): void {
  optMetaCache.clear();
}
const getNestedValue = (obj: any, path: string) => {
  let keys = pathCache.get(path);
  if (!keys) {
    keys = path.split(".");
    pathCache.set(path, keys);
  }
  let cursor = obj;
  for (let i = 0; i < keys.length; i++) {
    cursor = cursor?.[keys[i]];
  }
  return cursor;
};

const parseMetricValue = (value: any): number | null => {
  if (value == null) return null;
  if (typeof value === "object" && "parsedValue" in value)
    return parseMetricValue(value.parsedValue);
  const num = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(num) ? num : null;
};

const asGreekOrNull = (value: any): number | null => {
  const greek = parseMetricValue(value);
  if (greek == null) return null;
  if (Math.abs(greek) >= 900) return null;
  return greek;
};

const parseMarginReq = (
  row: HoldingsRow,
): { val: number | null; reason: string | null } => {
  const val = parseMetricValue(
    getNestedValue(row, "marginReq.val") ??
      getNestedValue(row, "marginRequirement.val"),
  );
  if (val != null) {
    const kind = getInstrumentKind(row);
    if (kind === "EQUITY") return { val, reason: "Equity" };
    if (kind === "OPTION") return { val, reason: "-" };
    return { val, reason: null };
  }

  const lbl =
    getNestedValue(row, "marginReq.lbl") ??
    getNestedValue(row, "marginRequirement.lbl");
  if (typeof lbl === "string") {
    const cleanLbl = lbl.trim();

    if (cleanLbl === "-") return { val: 0, reason: "-" };

    const dollarMatch = cleanLbl.match(/^(.*?)\s*\$\s*([\d,]+(\.\d+)?)/);
    if (dollarMatch) {
      const reason = dollarMatch[1].trim();
      const amount = parseFloat(dollarMatch[2].replace(/,/g, ""));
      return { val: amount, reason: reason || null };
    }

    const numberOnly = cleanLbl.replace(/,/g, "");
    if (/^-?\d+(\.\d+)?$/.test(numberOnly)) {
      const amount = parseFloat(numberOnly);
      const kind = getInstrumentKind(row);
      if (kind === "EQUITY") return { val: amount, reason: "Equity" };
      if (kind === "OPTION") return { val: amount, reason: "-" };
      return { val: amount, reason: null };
    }
  }

  return { val: null, reason: null };
};

export function computeDerivedMetrics(row: HoldingsRow): DerivedMetricsRow {
  const bid = parseMetricValue(getNestedValue(row, "bid.val"));
  const ask = parseMetricValue(getNestedValue(row, "ask.val"));
  const bidSize = parseMetricValue(getNestedValue(row, "bidSize.val"));
  const askSize = parseMetricValue(getNestedValue(row, "askSize.val"));

  const dayHigh = parseMetricValue(getNestedValue(row, "dayHigh.val"));
  const dayLow = parseMetricValue(getNestedValue(row, "dayLow.val"));
  const close = parseMetricValue(
    getNestedValue(row, "closePrice.val") ?? getNestedValue(row, "close.val"),
  );

  const qty = parseMetricValue(
    getNestedValue(row, "qty.qty") ??
      getNestedValue(row, "qty.val") ??
      getNestedValue(row, "qty.qtyBeforeSplt"),
  );

  const marketValue = parseMetricValue(getNestedValue(row, "marketValue.val"));

  const delta = asGreekOrNull(getNestedValue(row, "delta.val"));
  const gamma = asGreekOrNull(getNestedValue(row, "gamma.val"));
  const theta = asGreekOrNull(getNestedValue(row, "theta.val"));
  const vega = asGreekOrNull(getNestedValue(row, "vega.val"));
  const rho = asGreekOrNull(getNestedValue(row, "rho.val"));

  const { val: marginReq, reason: marginReqReason } = parseMarginReq(row);

  const kind = getInstrumentKind(row);
  const multiplier = kind === "OPTION" ? DEFAULT_OPTION_MULTIPLIER : 1;

  const optMeta = kind === "OPTION" ? getCachedOptMeta(row) : null;

  const mid = bid != null && ask != null ? (bid + ask) / 2 : null;
  const spreadDol = bid != null && ask != null ? ask - bid : null;
  const spreadPct = safeDiv(spreadDol, mid);

  const imbalance = (() => {
    const den = bidSize != null && askSize != null ? bidSize + askSize : null;
    const num = bidSize != null && askSize != null ? bidSize - askSize : null;
    return safeDiv(num, den);
  })();

  const dayRangeDol =
    dayHigh != null && dayLow != null ? dayHigh - dayLow : null;
  const dayRangePct = safeDiv(dayRangeDol, close);

  const lastPrice = parseMetricValue(
    getNestedValue(row, "lastPrice.val") ??
      getNestedValue(row, "price.price") ??
      getNestedValue(row, "price.val"),
  );
  const underlyingPriceCandidate = parseMetricValue(
    getNestedValue(row, "underlyingPrice") ??
      getNestedValue(row, "quote.underlyingPrice"),
  );

  const deltaShares =
    kind === "EQUITY"
      ? (qty ?? 0)
      : qty != null && delta != null
        ? qty * multiplier * delta
        : null;
  const gammaSharesPerDol =
    kind === "EQUITY"
      ? 0
      : qty != null && gamma != null
        ? qty * multiplier * gamma
        : null;
  const thetaPerDay =
    kind === "EQUITY"
      ? 0
      : qty != null && theta != null
        ? qty * multiplier * theta
        : null;
  const vegaPerVolPoint =
    kind === "EQUITY"
      ? 0
      : qty != null && vega != null
        ? qty * multiplier * vega
        : null;
  const rhoPer1pctRate =
    kind === "EQUITY"
      ? 0
      : qty != null && rho != null
        ? qty * multiplier * rho
        : null;
  const absGammaSharesPerDol =
    gammaSharesPerDol != null ? Math.abs(gammaSharesPerDol) : null;
  const absVegaPerVolPoint =
    vegaPerVolPoint != null ? Math.abs(vegaPerVolPoint) : null;

  const marginUsageRatioPct = safeDiv(
    marginReq,
    marketValue != null ? Math.abs(marketValue) : null,
  );
  const deltaSharesPerMargin = safeDiv(deltaShares, marginReq);
  const thetaPerMargin = safeDiv(thetaPerDay, marginReq);
  const vegaPerMargin = safeDiv(vegaPerVolPoint, marginReq);
  const gammaOnMargin = safeDiv(
    gammaSharesPerDol != null ? Math.abs(gammaSharesPerDol) : null,
    marginReq,
  );
  const thetaOnMargin = safeDiv(thetaPerDay, marginReq);
  const vegaOnMargin = safeDiv(
    vegaPerVolPoint != null ? Math.abs(vegaPerVolPoint) : null,
    marginReq,
  );
  const carryPerVega = safeDiv(
    thetaPerDay,
    vegaPerVolPoint != null ? Math.abs(vegaPerVolPoint) : null,
  );
  const carryPerGamma = safeDiv(
    thetaPerDay,
    gammaSharesPerDol != null ? Math.abs(gammaSharesPerDol) : null,
  );

  const underlyingNotional = (() => {
    if (qty == null) return null;
    const absQty = Math.abs(qty);

    if (kind === "OPTION") {
      const strike = optMeta?.strike;
      if (strike != null && strike > 0) {
        return absQty * multiplier * strike;
      }
      const effectiveUnderlyingPrice =
        underlyingPriceCandidate ??
        lastPrice ??
        (marketValue != null && absQty !== 0
          ? Math.abs(marketValue) / absQty
          : null) ??
        close;
      if (effectiveUnderlyingPrice == null) return null;
      return absQty * multiplier * effectiveUnderlyingPrice;
    }

    if (kind === "EQUITY") {
      const effectiveUnderlyingPrice =
        underlyingPriceCandidate ??
        lastPrice ??
        (marketValue != null && absQty !== 0
          ? Math.abs(marketValue) / absQty
          : null) ??
        close;
      if (effectiveUnderlyingPrice == null) return null;
      return absQty * effectiveUnderlyingPrice;
    }

    return null;
  })();
  const marginToUnderlyingNotional = safeDiv(marginReq, underlyingNotional);

  const optDeltaShares =
    kind === "OPTION" && deltaShares != null ? deltaShares : null;

  return {
    holdingsRowType: row?.rowType ?? null,
    holdingsSecurityType: row?.securityType ?? null,

    underlying: optMeta?.underlying ?? null,
    expDate: optMeta?.expDate ?? null,
    dte: optMeta?.dte ?? null,
    strike: optMeta?.strike ?? null,
    callPut: optMeta?.callPut ?? null,

    mid,
    spreadDol,
    spreadPct,
    quoteImbalance: imbalance,
    dayRangeDol,
    dayRangePct,

    deltaShares,
    gammaSharesPerDol,
    thetaPerDay,
    vegaPerVolPoint,
    absGammaSharesPerDol,
    absVegaPerVolPoint,
    rhoPer1pctRate,

    marginUsageRatioPct,
    deltaSharesPerMargin,
    thetaPerMargin,
    vegaPerMargin,
    gammaOnMargin,
    thetaOnMargin,
    vegaOnMargin,
    carryPerVega,
    carryPerGamma,
    marginReqDol: marginReq,
    marginReqReason,
    marginToUnderlyingNotional,

    optDeltaShares,
  };
}

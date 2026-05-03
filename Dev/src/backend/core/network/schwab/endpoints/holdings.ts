import { generateUUID } from "shared/utils/data/uuid";
import { resolveCustomerIdFromPage } from "../infra/initContext";
import type{ HoldingsResponse, HoldingsRow, HoldingsTotals } from "shared/types/holdings";
import { throw401, withTokenRefresh } from "../infra/httpUtils";
import { computeWorkerPool } from "backend/computation/workers/ComputeWorkerPool";
import { logService } from "shared/log/core/LogService";
import { getHoldingsKey } from "shared/utils/domain/holdingsKeys";

const log = logService.namespace("network");
const holdFlow = logService.namespace("flow:hold");

export function fetchAccountInfo(
  token?: string | null,
): Promise<{ accountId: string; customerId: string | null }> {
  const span = log.span("fetchAccountInfo");
  const url =
    "https://ausgateway.schwab.com/api/is.Holdings/V1/Holdings/accounts-details";

  const doRequest = async (bearerToken: string): Promise<unknown> => {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: "Bearer " + bearerToken,
        correlatorid: generateUUID(),
        "schwab-client-correlid": generateUUID(),
        "schwab-client-appid": "AD00008376",
        "schwab-client-channel": "IO",
        "schwab-env": "PROD",
        "schwab-environment": "PROD",
      },
    });

    if (response.status === 401) {
      await throw401(response);
    }

    return response.json() as Promise<unknown>;
  };

  return withTokenRefresh(doRequest, token)
    .then((payload: any) => {
      const customerId = resolveCustomerIdFromPage();
      const accountId = String(
        payload?.accountsData?.accountDetails?.[0]?.id ?? "",
      ); // API: accountsData.accountDetails[0].id
      span.end(
        "ok",
        { hasAccountId: !!accountId, hasCustomerId: !!customerId },
        "info",
      );
      return { accountId, customerId };
    })
    .catch((err) => {
      span.end(
        "error",
        { error: (err as Error)?.message ?? String(err) },
        "error",
      );
      throw err;
    });
}

export function fetchHoldings(
  token: string | null | undefined,
  accountId: string,
  options?: { isExtendedPricing?: boolean },
): Promise<HoldingsResponse> {
  const extPricing = options?.isExtendedPricing ?? false;
  const span = log.span("fetchHoldings", { accountId, extPricing });
  const url =
    "https://ausgateway.schwab.com/api/is.Holdings/V1/Holdings/HoldingV2";
  const holdingsRequest = {
    entitlement: "NP",
    featureFlags: { "enable-extended-hours": true },
    fetchSettings: false,
    groupBySecurityType: true,
    groupByStrategy: false,
    groupByUnderlying: true,
    isExtendedPricing: extPricing,
    isNWE: false,
    // Each column maps 1:1 to a HoldingsRow field (shared/types.ts).
    // The API populates the corresponding cell object in each row.
    selectedColumns: [
      "price", // -> HoldingsRow.price (HoldingsPriceCell)
      "dayChangePercent", // -> HoldingsRow.dayChngPerc.val (ratio after normalization)
      "dayChangeDollar", // -> HoldingsRow.dayChange.val
      "quantity", // -> HoldingsRow.qty (HoldingsQtyCell)
      "gainLossDollar", // -> HoldingsRow.gainLoss.gainLossDol
      "gainLossPercent", // -> HoldingsRow.gainLoss.gainLossPct (ratio after normalization)
      "costPerShare", // -> HoldingsRow.costBasis.costPerShare
      "percentageOfAccount", // -> HoldingsRow.pctOfAcct.val (ratio after normalization)
      "marketValue", // -> HoldingsRow.marketValue.val
      "costBasis", // -> HoldingsRow.costBasis.costBasis
      "priceChangePercent", // -> HoldingsRow.priceChngPrc.val (ratio after normalization)
      "priceChangeDollar", // -> HoldingsRow.priceChng.val
      "volume", // -> HoldingsRow.volume.val
      "vega", // -> HoldingsRow.vega.val (option Greek)
      "delta", // -> HoldingsRow.delta.val (option Greek)
      "gamma", // -> HoldingsRow.gamma.val (option Greek)
      "theta", // -> HoldingsRow.theta.val (option Greek)
      "rho", // -> HoldingsRow.rho.val (option Greek)
      "openInterest", // -> HoldingsRow.openInterest.val
      "marginRequirement", // -> HoldingsRow.marginReq.lbl
      "close", // -> HoldingsRow.closePrice.val
      "open", // -> HoldingsRow.openPrice.val
      "dayLow", // -> HoldingsRow.dayLow.val
      "dayHigh", // -> HoldingsRow.dayHigh.val
    ],
  };

  const doRequest = async (bearerToken: string): Promise<unknown> => {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: "Bearer " + bearerToken,
        correlatorid: generateUUID(),
        "schwab-client-correlid": generateUUID(),
        "schwab-client-ids": accountId,
        "schwab-channelcode": "IO",
        "schwab-client-appid": "AD00008376",
        "schwab-client-channel": "IO",
        "schwab-env": "PROD",
        "schwab-environment": "PROD",
        "schwab-resource-version": "V2",
        "cache-control": "no-cache",
        pragma: "no-cache",
      },
      body: JSON.stringify(holdingsRequest),
    });

    if (response.status === 401) {
      await throw401(response);
    }

    return response.json() as Promise<unknown>;
  };

  return withTokenRefresh(doRequest, token)
    .then((payload: unknown) => computeWorkerPool.parseHoldings(payload))
    .then((result) => {
      span.end("ok", { accountCount: result.accounts?.length ?? 0 }, "debug");
      return result;
    })
    .catch((err) => {
      span.end(
        "error",
        { error: (err as Error)?.message ?? String(err) },
        "error",
      );
      throw err;
    });
}

// ── Extended-hours dual fetch ────────────────────────────────────────────────

/**
 * Fetch holdings with both isExtendedPricing=true and false in parallel,
 * then merge the two responses:
 *   - Base: extended (true) response for most columns
 *   - Override price/priceChng/priceChngPrc from regular (false) response
 *   - ADD dayChange/dayChngPerc from both responses
 */
export async function fetchDualHoldings(
  token: string | null | undefined,
  accountId: string,
): Promise<HoldingsResponse> {
  const span = log.span("fetchDualHoldings", { accountId });
  try {
    const [extendedResponse, regularResponse] = await Promise.all([
      fetchHoldings(token, accountId, { isExtendedPricing: true }),
      fetchHoldings(token, accountId, { isExtendedPricing: false }),
    ]);
    const merged = mergeExtendedHoldingsResponses(
      extendedResponse,
      regularResponse,
    );
    span.end("ok", { accountCount: merged.accounts?.length ?? 0 }, "debug");
    return merged;
  } catch (err) {
    span.end(
      "error",
      { error: (err as Error)?.message ?? String(err) },
      "error",
    );
    throw err;
  }
}

/**
 * Build a row lookup from a HoldingsResponse keyed by holdingsKey.
 */
function buildRowMapByKey(
  response: HoldingsResponse,
): Map<string, HoldingsRow> {
  const map = new Map<string, HoldingsRow>();
  for (const acct of (response as any).accounts ?? []) {
    for (const group of (acct as any).groupedPositions ?? []) {
      for (const row of (group as any).holdingsRows ?? []) {
        const key = getHoldingsKey(row);
        if (key) map.set(key, row);
        for (const child of (row as any).childRows ?? []) {
          const ck = getHoldingsKey(child);
          if (ck) map.set(ck, child);
        }
      }
    }
  }
  return map;
}

/**
 * Merge a single holdings row: override price fields from regular,
 * ADD dayChange fields from both.
 */
function mergeRowFields(extRow: any, regRow: any): void {
  // price, priceChng, priceChngPrc → use regular (isExtendedPricing=false)
  if (regRow.price != null) extRow.price = regRow.price;
  if (regRow.priceChng != null) extRow.priceChng = regRow.priceChng;
  if (regRow.priceChngPrc != null) extRow.priceChngPrc = regRow.priceChngPrc;

  // dayChange / dayChngPerc → keep extended values as-is.
  // Both APIs measure from yesterday's close; extended includes AH movement,
  // regular only reaches the regular-session close. They are NOT complementary
  // increments, so adding them would double-count the regular-session portion.
}

/**
 * Merge totals: extended totals are kept as-is for dayChange fields
 * (they already include the full day change from yesterday's close to current AH price).
 * No fields are modified — this is intentionally a no-op.
 */
function mergeExtendedTotals(
  _extTotals: HoldingsTotals | undefined,
  _regTotals: HoldingsTotals | undefined,
  _label?: string,
): void {
  // Totals are kept from extended response as-is; nothing to merge.
}

/**
 * Merge two HoldingsResponses: extended (base) with regular overrides.
 */
function mergeExtendedHoldingsResponses(
  extended: HoldingsResponse,
  regular: HoldingsResponse,
): HoldingsResponse {
  const regularRowMap = buildRowMapByKey(regular);
  let mergedRowCount = 0;
  let unmatchedRowCount = 0;

  // Walk all rows in the extended response and patch fields
  for (const acct of (extended as any).accounts ?? []) {
    for (const group of (acct as any).groupedPositions ?? []) {
      for (const row of (group as any).holdingsRows ?? []) {
        const key = getHoldingsKey(row);
        const regRow = key ? regularRowMap.get(key) : null;
        if (regRow) {
          mergeRowFields(row, regRow);
          mergedRowCount++;
        } else {
          unmatchedRowCount++;
        }

        for (const child of (row as any).childRows ?? []) {
          const ck = getHoldingsKey(child);
          const regChild = ck ? regularRowMap.get(ck) : null;
          if (regChild) {
            mergeRowFields(child, regChild);
            mergedRowCount++;
          } else {
            unmatchedRowCount++;
          }
        }
      }
      // Merge group-level totals
      const regGroup = findMatchingGroup(regular, acct, group);
      const groupType = (group as any).securityType ?? "?";
      if (regGroup)
        mergeExtendedTotals(
          (group as any).totals,
          (regGroup as any).totals,
          `group:${groupType}`,
        );
    }
    // Merge account-level totals
    const regAcct = findMatchingAccount(regular, acct);
    const acctId =
      (acct as any).accountId ?? (acct as any).accountDetail?.id ?? "?";
    if (regAcct)
      mergeExtendedTotals(
        (acct as any).totals,
        (regAcct as any).totals,
        `account:${acctId}`,
      );
  }

  // Merge top-level accountTotals
  mergeExtendedTotals(
    extended.accountTotals,
    regular.accountTotals,
    "accountTotals",
  );

  if (holdFlow.levelEnabled("debug")) {
    holdFlow.debug("merge:summary", {
      mergedRows: mergedRowCount,
      unmatchedRows: unmatchedRowCount,
      regularMapSize: regularRowMap.size,
      finalTotals: {
        dayChgDollar: extended.accountTotals?.dayChangeDollar,
        dayChgPct: extended.accountTotals?.dayChangePercent,
        marketValue: extended.accountTotals?.marketValue,
      },
    });
  }

  return extended;
}

function findMatchingAccount(response: HoldingsResponse, targetAcct: any): any {
  const targetId = targetAcct?.accountId ?? targetAcct?.accountDetail?.id;
  for (const acct of (response as any).accounts ?? []) {
    const id = acct?.accountId ?? acct?.accountDetail?.id;
    if (id === targetId) return acct;
  }
  // Fallback: if single account, return the first
  if ((response as any).accounts?.length === 1)
    return (response as any).accounts[0];
  return null;
}

function findMatchingGroup(
  response: HoldingsResponse,
  targetAcct: any,
  targetGroup: any,
): any {
  const acct = findMatchingAccount(response, targetAcct);
  if (!acct) return null;
  const targetType = targetGroup?.securityType;
  for (const group of acct?.groupedPositions ?? []) {
    if (group?.securityType === targetType) return group;
  }
  return null;
}

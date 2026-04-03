/**
 * Barrons data fetcher and parser.
 * Fetches from multiple Barrons/MarketWatch endpoints (HTML + JSON APIs).
 * All parsed data is assembled into a BarronsDataBundle (see ai/types.ts).
 * See inline comments in each parser function for API -> internal field mappings.
 */
import { gmGetWithHeaders } from "../yahoo/httpUtils";
import { logService } from "shared/log/core/LogService";

const log = logService.namespace("network");

import type {
  BarronsAnalystSnapshot,
  BarronsCompanyDetails,
  BarronsDataBundle,
  BarronsEstimate,
  BarronsEstimateTrend,
  BarronsFinancialRatios,
  BarronsFinancialStatement,
  BarronsHolder,
  BarronsNewsStory,
  BarronsPeer,
  BarronsPerson,
  BarronsPriceTarget,
  BarronsRatingsTableRow,
  BarronsStatementRow,
} from "./types";

// ── Barron's transport helpers ──────────────────────────────────────────────

function fetchBarronsJson(
  url: string,
  symbol: string,
  timeoutMs = 30_000,
): Promise<any> {
  return gmGetWithHeaders(
    url,
    {
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "en,zh-CN;q=0.9,zh-TW;q=0.8,zh;q=0.7",
      Referer: `https://www.barrons.com/market-data/stocks/${symbol}`,
    },
    timeoutMs,
  ).then((text) => JSON.parse(text));
}

function fetchBarronsHtml(url: string, timeoutMs = 30_000): Promise<string> {
  return gmGetWithHeaders(
    url,
    {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en,zh-CN;q=0.9,zh-TW;q=0.8,zh;q=0.7",
    },
    timeoutMs,
  );
}

// ── Parse helpers ───────────────────────────────────────────────────────────

function formattedValue(o: any): string | null {
  return o?.formatted ?? o?.value ?? null;
}

function metricValue(o: any): any {
  return o?.value?.value ?? o?.value ?? null;
}

function extractNextData(html: string): any | null {
  const marker = "__NEXT_DATA__";
  const idx = html.indexOf(marker);
  if (idx === -1) return null;
  const jsonStart = html.indexOf(">", idx) + 1;
  const jsonEnd = html.indexOf("</script>", jsonStart);
  try {
    return JSON.parse(html.slice(jsonStart, jsonEnd).trim());
  } catch {
    return null;
  }
}

// ── Financial statement parser ──────────────────────────────────────────────

function extractFinancialStatementCard(data: any): { sections: any[] } | null {
  let arr = data;
  if (arr && !Array.isArray(arr)) {
    arr = arr.blocks ?? arr.data ?? arr.body ?? arr.results ?? arr.items;
    if (!Array.isArray(arr)) {
      if (
        arr?.["$type"] === "MarketData.FinancialStatementCard" &&
        arr.sections?.length
      ) {
        return {
          sections: arr.sections.map((s: any) => ({
            header: s.sectionHeader ?? "",
            items: s.items ?? [],
            columns: s.columns ?? [],
            fiscalYear: s.fiscalYear ?? "",
          })),
        };
      }
      return null;
    }
  }
  if (!Array.isArray(arr)) return null;
  const card = arr.find(
    (c: any) => c?.["$type"] === "MarketData.FinancialStatementCard",
  );
  if (!card?.sections?.length) return null;
  return {
    sections: card.sections.map((s: any) => ({
      header: s.sectionHeader ?? "",
      items: s.items ?? [],
      columns: s.columns ?? [],
      fiscalYear: s.fiscalYear ?? "",
    })),
  };
}

function parseStatement(apiData: any): BarronsFinancialStatement | null {
  const extracted = extractFinancialStatementCard(apiData);
  if (!extracted) return null;

  const allRows: BarronsStatementRow[] = [];
  let columns: string[] = [];
  let fiscalYear = "";

  for (const sec of extracted.sections) {
    if (!columns.length) columns = sec.columns;
    if (!fiscalYear) fiscalYear = sec.fiscalYear;

    if (extracted.sections.length > 1 && sec.header) {
      allRows.push({
        name: `── ${sec.header} ──`,
        values: [],
        rawValues: [],
        type: 3,
        level: 0,
        isSectionHeader: true,
      });
    }

    function walk(items: any[], depth: number): void {
      for (const item of items) {
        allRows.push({
          name: item.displayName, // API: items[].displayName
          values: (item.values ?? []).map((v: any) => v?.formatted ?? "-"), // API: items[].values[].formatted
          rawValues: (item.values ?? []).map((v: any) => v?.value ?? null), // API: items[].values[].value
          type: item.type ?? 0,
          level: item.level ?? depth,
        });
        if (item.items?.length) walk(item.items, depth + 1);
      }
    }
    walk(sec.items, 0);
  }

  return { columns, fiscalYear, rows: allRows };
}

// ── News parser ─────────────────────────────────────────────────────────────

function extractNews(apiData: any): BarronsNewsStory[] {
  const stories = apiData?.blocks?.[0]?.blocks ?? [];
  return stories
    .filter((s: any) => s?.["$type"] === "News.StoryCard")
    .map((s: any) => ({
      headline: s.headline ?? "",
      summary: s.summary ?? "",
      byline: s.byline ?? "",
      url: s.url ?? "",
      timestamp: s.timestampUtc?.formatted ?? "",
      timestampValue: s.timestampUtc?.value ?? "",
      provider: s.provider ?? "",
      label: s.label?.display ?? s.sectionLabel?.display ?? "",
    }));
}

// ── URL builders ────────────────────────────────────────────────────────────

function buildBarronsUrls(symbol: string) {
  const base = `https://www.barrons.com/market-data/stocks/${symbol}`;
  const finApiBase =
    `https://www.barrons.com/market-data/api/proxy?` +
    `https://quote-barrons.millstone.mktw.dowjones.io/api/quote/financials` +
    `?chartingSymbol=stock///${symbol}&urlFragment=`;
  const millstoneBase = `https://www.barrons.com/market-data/api/millstone?ticker=${symbol}&PAGE=`;
  const profileFetchUrl = `https://quote-barrons.millstone.mktw.dowjones.io/api/quote/profile?chartingSymbol=stock///${symbol}`;
  const ufcJson = encodeURIComponent(
    JSON.stringify({
      defaultLoginUrl: `https://www.barrons.com/client/login?target=${encodeURIComponent(`http://www.barrons.com/market-data/stocks/${symbol}/company-people`)}`,
      pandaAPI: "https://follow-api.barrons.com",
      ufcLoader: "https://www.barrons.com/asset/dj-ufc/loaders/barrons.js",
      captchaSiteKey: "6LcmI7sUAAAAAF-vTKb3JIwIzz2CXCx8hJW0Ukis",
    }),
  );
  const overviewPage = encodeURIComponent(
    '{"renderTab":"","assetType":"stock","analyticsValue":"stockoverview"}',
  );
  const companyPage = encodeURIComponent(
    '{"renderTab":"company-people","assetType":"stock","analyticsValue":"stockcompany"}',
  );
  const newsBase = `https://www.barrons.com/market-data/api/news?chartingSymbol=stock///${symbol}&pageNumber=0&count=40`;

  return {
    ratings: `${base}/research-ratings`,
    overview: `${millstoneBase}${overviewPage}&ufc=%7B`,
    companyPeople: `${millstoneBase}${companyPage}&ufc=${ufcJson}&fetchUrl=${encodeURIComponent(profileFetchUrl)}&countrycode=&iso=`,
    finIncome: `${finApiBase}income/annual`,
    finBalance: `${finApiBase}balance-sheet/annual`,
    finCashFlow: `${finApiBase}cash-flow/annual`,
    finIncomeQ: `${finApiBase}income/quarter`,
    finBalanceQ: `${finApiBase}balance-sheet/quarter`,
    finCashFlowQ: `${finApiBase}cash-flow/quarter`,
    newsBarrons: `${newsBase}&channel=Barrons`,
    newsDowJones: `${newsBase}&channel=BarronsDowJonesNetwork`,
    newsPR: `${newsBase}&channel=BarronsPressReleases`,
  };
}

// ── News-only fetch (lightweight, for the news page) ────────────────────────

export async function fetchBarronsNewsOnly(
  symbol: string,
): Promise<{
  barrons: BarronsNewsStory[];
  dowJones: BarronsNewsStory[];
  press: BarronsNewsStory[];
}> {
  const newsBase = `https://www.barrons.com/market-data/api/news?chartingSymbol=stock///${symbol}&pageNumber=0&count=40`;
  const [b, dj, pr] = await Promise.all([
    fetchBarronsJson(`${newsBase}&channel=Barrons`, symbol).catch(() => null),
    fetchBarronsJson(
      `${newsBase}&channel=BarronsDowJonesNetwork`,
      symbol,
    ).catch(() => null),
    fetchBarronsJson(`${newsBase}&channel=BarronsPressReleases`, symbol).catch(
      () => null,
    ),
  ]);
  const result = {
    barrons: extractNews(b),
    dowJones: extractNews(dj),
    press: extractNews(pr),
  };
  log.debug("news.fetch.barrons", {
    symbol,
    barrons: result.barrons.length,
    dowJones: result.dowJones.length,
    press: result.press.length,
  });
  return result;
}

// ── Main fetch + parse ──────────────────────────────────────────────────────

export async function fetchBarronsData(
  symbol: string,
): Promise<BarronsDataBundle | null> {
  const span = log.span("fetchBarronsData", { symbol });
  const urls = buildBarronsUrls(symbol);

  // Fetch HTML page + 11 JSON APIs in parallel with individual error handling
  const [
    ratingsHtml,
    overviewData,
    companyPeopleData,
    finIncomeData,
    finBalanceData,
    finCashFlowData,
    finIncomeQData,
    finBalanceQData,
    finCashFlowQData,
    newsBarronsData,
    newsDowJonesData,
    newsPRData,
  ] = await Promise.all([
    fetchBarronsHtml(urls.ratings)
      .then(extractNextData)
      .catch(() => null),
    fetchBarronsJson(urls.overview, symbol).catch(() => null),
    fetchBarronsJson(urls.companyPeople, symbol).catch(() => null),
    fetchBarronsJson(urls.finIncome, symbol).catch(() => null),
    fetchBarronsJson(urls.finBalance, symbol).catch(() => null),
    fetchBarronsJson(urls.finCashFlow, symbol).catch(() => null),
    fetchBarronsJson(urls.finIncomeQ, symbol).catch(() => null),
    fetchBarronsJson(urls.finBalanceQ, symbol).catch(() => null),
    fetchBarronsJson(urls.finCashFlowQ, symbol).catch(() => null),
    fetchBarronsJson(urls.newsBarrons, symbol).catch(() => null),
    fetchBarronsJson(urls.newsDowJones, symbol).catch(() => null),
    fetchBarronsJson(urls.newsPR, symbol).catch(() => null),
  ]);

  // If all critical APIs failed, return null
  if (!overviewData && !companyPeopleData && !ratingsHtml) {
    span.end("empty", { reason: "all_critical_apis_failed" }, "warn");
    return null;
  }

  // Resolve props wrappers
  const ovPP = overviewData?.props ?? overviewData ?? {};
  const rrPP = ratingsHtml?.props?.pageProps ?? {};
  const cpRaw = companyPeopleData;
  const cpPP = cpRaw?.props?.CompanyProfileCard
    ? cpRaw.props
    : cpRaw?.CompanyProfileCard
      ? cpRaw
      : (cpRaw?.props ?? cpRaw ?? {});
  const blocks: any[] = rrPP.analystEstimatesData ?? [];

  const byType = (t: string) => blocks.find((b: any) => b?.["$type"] === t);
  const allByType = (t: string) =>
    blocks.filter((b: any) => b?.["$type"] === t);

  // ── Parse overview data ─────────────────────────────────────────────────

  const titleCard =
    byType("MarketData.TitleCard") ?? ovPP.titleCard ?? cpPP.titleCard;
  const sym = titleCard?.symbol ?? symbol.toUpperCase();

  // About / description
  const descCard = ovPP.descriptionCard ?? cpPP.CompanyDescriptionCard;
  const about: string | null = descCard?.description?.length
    ? descCard.description.join("\n")
    : null;

  // Key Data
  let keyData: Record<string, string> | null = null;
  const keyDataCard = ovPP.keyDataCard ?? cpPP.keyDataCard;
  if (keyDataCard?.dataPoints) {
    keyData = {};
    for (const dp of keyDataCard.dataPoints) {
      const key: string = dp.key ?? dp.label ?? dp.display ?? "?";
      let val: string = dp.value?.primaryValue ?? formattedValue(dp.value) ?? "";
      if (dp.value?.secondaryValue) val += ` (${dp.value.secondaryValue})`;
      keyData[key] = val;
    }
  }

  // Performance
  let performance: Record<string, string> | null = null;
  const perfCard =
    rrPP.performanceCard ?? ovPP.performanceCard ?? cpPP.performanceCard;
  if (perfCard) {
    const periods = [
      "fiveDay",
      "oneMonth",
      "threeMonth",
      "yearToDate",
      "oneYear",
    ] as const;
    const labels = ["5 Day", "1 Month", "3 Month", "YTD", "1 Year"];
    performance = {};
    periods.forEach((k, i) => {
      const p = perfCard[k];
      if (p)
        performance![labels[i]] =
          p.changePercent?.formatted ?? p.change?.formatted ?? "";
    });
  }

  // Holders
  let holders: BarronsDataBundle["holders"] = null;
  const holdersCard = ovPP.majorHoldersCard ?? cpPP.majorHoldersCard;
  if (holdersCard) {
    const mapHolder = (h: any): BarronsHolder => ({
      name: h.holder,
      shares: formattedValue(h.sharesOwned),
      pctOutstanding: formattedValue(h.percentageOutstanding),
      pctAssets: formattedValue(h.percentageOfPortfolio),
      chgShares: formattedValue(h.changeInShares),
      asOf: formattedValue(h.asOfDate),
    });
    const mf = (holdersCard.mutualFunds ?? []).map(mapHolder);
    const inst = (holdersCard.institutional ?? []).map(mapHolder);
    const indiv = (holdersCard.individuals ?? []).map(mapHolder);
    if (mf.length || inst.length || indiv.length) {
      holders = { mutualFunds: mf, institutional: inst, individuals: indiv };
    }
  }

  // People
  const cpBlocksRaw: any[] = Array.isArray(cpPP.data?.blocks)
    ? cpPP.data.blocks
    : [];
  const cpBlocks: any[] = [];
  for (const b of cpBlocksRaw) {
    cpBlocks.push(b);
    if (b?.["$type"] === "TabbedCard" && Array.isArray(b.tabs)) {
      for (const tab of b.tabs) {
        if (Array.isArray(tab.blocks)) {
          for (const inner of tab.blocks) cpBlocks.push(inner);
        }
      }
    }
  }
  const cpByType = (t: string) => cpBlocks.find((b: any) => b?.["$type"] === t);

  let people: BarronsDataBundle["people"] = null;
  const peopleCard =
    cpPP.peopleCard ??
    ovPP.peopleCard ??
    cpByType("MarketData.KeyExecutivesCard");
  if (peopleCard) {
    const mapPerson = (p: any): BarronsPerson => ({
      name: p.fullName,
      title: p.jobTitle,
      age: formattedValue(p.age),
    });
    const execs = (peopleCard.executives ?? []).map(mapPerson);
    const board = (peopleCard.boardMembers ?? []).map(mapPerson);
    if (execs.length || board.length) {
      people = { executives: execs, boardMembers: board };
    }
  }

  // Peers
  let peers: BarronsPeer[] | null = null;
  const peerCards = ovPP.instrumentListCard ?? cpPP.instrumentListCard ?? [];
  const peerCard = peerCards.find?.(
    (c: any) => c.instrumentListType === "Competitors",
  );
  if (peerCard?.instruments) {
    peers = peerCard.instruments.map((i: any) => ({
      name: i.display ?? i.name,
      symbol: i.symbol,
      price: i.trading?.price?.formatted,
      change: i.trading?.change?.formatted,
      changePct: i.trading?.changePercent?.formatted,
      marketCap: i.financials?.marketCap?.formatted,
    }));
  }

  // ── Parse company-people data ───────────────────────────────────────────

  const cpProfileNamed = cpPP.CompanyProfileCard;
  const hasNamedProfile =
    cpProfileNamed && Object.keys(cpProfileNamed).length > 1;
  const profile =
    cpByType("MarketData.CompanyProfileCard") ??
    (hasNamedProfile ? cpProfileNamed : null);
  const basicTablesFromBlocks = cpBlocks.filter(
    (b: any) => b?.["$type"] === "MarketData.BasicTableCard",
  );

  let companyDetails: BarronsCompanyDetails | null = null;
  if (profile) {
    companyDetails = {
      name: profile.name, // API: CompanyProfileCard.name
      industry: profile.industry, // API: CompanyProfileCard.industry
      sector: profile.sector, // API: CompanyProfileCard.sector
      fiscalYearEnd: formattedValue(profile.fiscalEndDate),
      revenue: profile.sales?.formatted, // API: CompanyProfileCard.sales (renamed!)
      netIncome: profile.netIncome?.formatted, // API: CompanyProfileCard.netIncome
      salesGrowth: formattedValue(profile.salesGrowth),
      employees: formattedValue(profile.numberEmployees),
      address: [
        profile.street1,
        [profile.city, profile.state].filter(Boolean).join(", "),
        profile.zipCode,
      ]
        .filter(Boolean)
        .join(", "),
      phone: profile.phoneNumber ?? null,
    };
  }

  // Override about from company-people if available
  const cpDesc =
    cpByType("MarketData.DescriptionCard") ?? cpPP.CompanyDescriptionCard;
  const resolvedAbout: string | null = cpDesc?.description?.length
    ? cpDesc.description.join("\n")
    : about;

  // Financial ratios
  const basicTablesNamed = cpPP.BasicTableCard?.length
    ? cpPP.BasicTableCard
    : [];
  const basicTables = basicTablesFromBlocks.length
    ? basicTablesFromBlocks
    : basicTablesNamed;
  const getTable = (name: string): Record<string, string> | null => {
    const card = basicTables.find(
      (c: any) => c.description?.toUpperCase() === name,
    );
    if (!card?.dataPoints) return null;
    const obj: Record<string, string> = {};
    for (const dp of card.dataPoints) {
      obj[dp.key] = dp.value?.primaryValue ?? formattedValue(dp.value) ?? "";
    }
    return obj;
  };

  const ratios: BarronsFinancialRatios = {
    valuation: getTable("VALUATION"),
    profitability: getTable("PROFITABILITY"),
    efficiency: getTable("EFFICIENCY"),
    capitalization: getTable("CAPITALIZATION"),
    liquidity: getTable("LIQUIDITY"),
  };

  // ── Parse research-ratings data ─────────────────────────────────────────

  const snapshot = rrPP.snapshotCard ?? ovPP.snapshotCard;
  let analystSnapshot: BarronsAnalystSnapshot | null = null;
  if (snapshot) {
    analystSnapshot = {
      avgRecommendation: formattedValue(snapshot.averageRecommendation), // API: snapshotCard.averageRecommendation
      meanRating: snapshot.meanRecommendationDisplay, // API: snapshotCard.meanRecommendationDisplay
      numRatings: formattedValue(snapshot.numberOfRatings), // API: snapshotCard.numberOfRatings
      meanTargetPrice: formattedValue(snapshot.meanTargetPrice), // API: snapshotCard.meanTargetPrice
      currentQtrEst: formattedValue(snapshot.currentQuarterEstimate),
      currentYearEst: formattedValue(snapshot.currentYearEstimate),
      nextFYEst: formattedValue(snapshot.nextFiscalYearEstimate),
      lastQtrEPS: formattedValue(snapshot.lastQuarterEarnings),
      fyReportDate: formattedValue(snapshot.fiscalYearReportDate),
    };
  }

  // Price targets
  let priceTarget: BarronsPriceTarget | null = null;
  const targets = byType("MarketData.StockPriceTargetsCard");
  if (targets) {
    const fmtPrice = (v: any): string | null => {
      const n = metricValue(v);
      return n != null ? `$${Number(n).toFixed(2)}` : null;
    };
    priceTarget = {
      high: fmtPrice(targets.high),
      low: fmtPrice(targets.low),
      median: fmtPrice(targets.median),
      average: fmtPrice(targets.average),
      currentPrice: fmtPrice(targets.currentPrice),
    };
  }

  // Ratings table
  let ratingsTable: BarronsDataBundle["ratingsTable"] = null;
  const ratingsTableCard = byType("MarketData.AnalystRatingsTableCard");
  if (ratingsTableCard) {
    const row = (period: any): BarronsRatingsTableRow => ({
      Buy: period?.buy?.value,
      Overweight: period?.overweight?.value,
      Hold: period?.hold?.value,
      Underweight: period?.underweight?.value,
      Sell: period?.sell?.value,
      Consensus: period?.meanRating,
    });
    ratingsTable = {
      threeMonthsPrior: row(ratingsTableCard.threeMonthsPrior),
      oneMonthPrior: row(ratingsTableCard.oneMonthPrior),
      current: row(ratingsTableCard.current),
    };
  }

  // Estimates
  const estCard = byType("MarketData.AnalystEstimatesCard");

  let yearlyEstimates: BarronsEstimate[] | null = null;
  if (estCard?.yearEstimates?.length) {
    yearlyEstimates = estCard.yearEstimates.map((e: any) => ({
      year: e.year,
      high: formattedValue(e.highEstimate),
      low: formattedValue(e.lowEstimate),
      average: formattedValue(e.meanEstimate),
      count: formattedValue(e.numberOfEstimates) ?? "N/A",
    }));
  }

  let quarterlyActuals: BarronsEstimate[] | null = null;
  if (estCard?.quarterActuals?.length) {
    quarterlyActuals = estCard.quarterActuals.map((q: any) => ({
      quarter: `${q.quarter} ${q.year}`,
      estimate: formattedValue(q.meanEstimate),
      actual: formattedValue(q.actual),
      surprise: formattedValue(q.difference),
    }));
  }

  let quarterlyEstimates: BarronsEstimate[] | null = null;
  if (estCard?.quarterEstimates?.length) {
    quarterlyEstimates = estCard.quarterEstimates.map((q: any) => ({
      quarter: `${q.quarter} ${q.year}`,
      high: formattedValue(q.highEstimate),
      low: formattedValue(q.lowEstimate),
      average: formattedValue(q.meanEstimate),
      count: formattedValue(q.numberOfEstimates) ?? "-",
    }));
  }

  // Estimate trends
  let estimateTrends: BarronsEstimateTrend[] | null = null;
  const trends = allByType("MarketData.EstimateTrendsCard");
  if (trends.length) {
    estimateTrends = trends.map((t: any) => ({
      period: t.timeFrame,
      current: t.current?.formatted,
      oneMonthAgo: t.oneMonthAgo?.formatted,
      threeMonthsAgo: t.threeMonthsAgo?.formatted,
    }));
  }

  // Upcoming reports
  let upcomingReports: BarronsDataBundle["upcomingReports"] = null;
  if (estCard?.nextQuarterReportDate) {
    upcomingReports = {
      nextQtr: `${estCard.nextReportQuarter} — ${estCard.nextQuarterReportDate}`,
      nextYear: `${estCard.nextReportYear} — ${estCard.nextYearReportDate}`,
    };
  }

  // ── Assemble bundle ─────────────────────────────────────────────────────

  span.end(
    "ok",
    {
      hasCompanyDetails: !!companyDetails,
      hasAnalystSnapshot: !!analystSnapshot,
      hasPriceTarget: !!priceTarget,
      hasFinancials: !!(finIncomeData || finBalanceData || finCashFlowData),
    },
    "info",
  );

  return {
    symbol: sym,
    companyDetails,
    about: resolvedAbout,
    ratios,
    keyData,
    analystSnapshot,
    priceTarget,
    ratingsTable,
    yearlyEstimates,
    quarterlyActuals,
    quarterlyEstimates,
    estimateTrends,
    upcomingReports,
    holders,
    people,
    peers,
    performance,
    incomeStatement: parseStatement(finIncomeData),
    balanceSheet: parseStatement(finBalanceData),
    cashFlowStatement: parseStatement(finCashFlowData),
    incomeStatementQ: parseStatement(finIncomeQData),
    balanceSheetQ: parseStatement(finBalanceQData),
    cashFlowStatementQ: parseStatement(finCashFlowQData),
    news: {
      barrons: extractNews(newsBarronsData),
      dowJones: extractNews(newsDowJonesData),
      press: extractNews(newsPRData),
    },
    fetchedAt: new Date().toISOString(),
  };
}

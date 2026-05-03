export function buildBarronsUrls(symbol: string) {
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

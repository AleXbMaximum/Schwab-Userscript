export const summaryComputeCode = `
function _computeSummaryMetrics(response, selectedExpiration) {
    var chains = (selectedExpiration && selectedExpiration.chains) || [];
    var totalCallVolume = 0, totalPutVolume = 0, totalCallOI = 0, totalPutOI = 0;
    for (var i = 0; i < chains.length; i++) {
        var c = chains[i];
        totalCallVolume += (c.call && c.call.vol) || 0;
        totalPutVolume += (c.put && c.put.vol) || 0;
        totalCallOI += (c.call && c.call.oi) || 0;
        totalPutOI += (c.put && c.put.oi) || 0;
    }
    return {
        underlyingPrice: response.underlyingPrice,
        totalCallVolume: totalCallVolume, totalPutVolume: totalPutVolume,
        totalCallOI: totalCallOI, totalPutOI: totalPutOI,
        pcRatioVolume: totalCallVolume > 0 ? totalPutVolume / totalCallVolume : null,
        pcRatioOI: totalCallOI > 0 ? totalPutOI / totalCallOI : null,
        maxPainStrike: _computeMaxPain(chains),
        atmStrike: _findATMStrike(chains, response.underlyingPrice),
    };
}

function _computeStateVector(response, expiration, gexAnalytics, emData) {
    var spot = response.underlyingPrice;
    var dte = expiration.daysUntil;
    var forward = _computeForwardPrice(spot, response.interestRate, response.dividendYield, dte);
    var termData = _computeTermStructure([expiration], spot);
    var atmIV = termData.length > 0 ? termData[0].avgIV : null;
    var skewMetric = _compute25DeltaRR(expiration.chains);
    return {
        spot: spot, forward: forward,
        forwardCarry: { rate: response.interestRate, divYield: response.dividendYield },
        selectedExpiry: expiration.label.split(',')[0],
        dte: dte, eventFlags: [],
        atmIV: atmIV, skewMetric: skewMetric,
        impliedMove1Sigma: emData.expectedMove,
        impliedMovePct: emData.expectedMovePct,
        netGex: gexAnalytics.totalNetGex,
        gammaFlip: gexAnalytics.flipPoint,
        dataTimestamp: response.currentDateTime || new Date().toISOString(),
        isDelayed: response.isDelayed || false,
    };
}
`;

export const qualityComputeCode = `
function _computeLiquidityScore(chains, underlyingPrice, threshold) {
    var byStrike = [];
    var filteredCount = 0;
    var weightedScore = 0;
    var totalWeight = 0;

    for (var i = 0; i < chains.length; i++) {
        var c = chains[i];
        var cSpread = _spreadPct(c.call && c.call.bid, c.call && c.call.ask);
        var pSpread = _spreadPct(c.put && c.put.bid, c.put && c.put.ask);
        var avgSpread = cSpread != null && pSpread != null
            ? (cSpread + pSpread) / 2
            : (cSpread != null ? cSpread : pSpread);
        var grade = _gradeFromSpreadPct(avgSpread);
        if (threshold > 0 && avgSpread != null && avgSpread > threshold) filteredCount++;
        var dist = underlyingPrice != null
            ? Math.abs(c.strike - underlyingPrice) / underlyingPrice : 0.5;
        var weight = Math.max(0, 1 - dist * 4);
        var gradeScore = grade === 'A' ? 100 : grade === 'B' ? 80 : grade === 'C' ? 60 : grade === 'D' ? 40 : 20;
        weightedScore += gradeScore * weight;
        totalWeight += weight;
        byStrike.push({
            strike: c.strike, callSpreadPct: cSpread, putSpreadPct: pSpread,
            callVolume: (c.call && c.call.vol) || 0, putVolume: (c.put && c.put.vol) || 0,
            qualityGrade: grade,
        });
    }

    var overallScore = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;
    var overallGrade = _gradeFromSpreadPct(
        overallScore >= 90 ? 0.5 : overallScore >= 70 ? 1.5 : overallScore >= 50 ? 3 : overallScore >= 30 ? 7 : 15
    );
    return {
        overallScore: overallScore, overallGrade: overallGrade,
        byStrike: byStrike, filteredCount: filteredCount, totalCount: chains.length,
    };
}

function _computeDataQuality(response, expiration, liquidityData, volDiag) {
    var chains = expiration.chains;
    var missingQuotes = 0, missingIV = 0;
    var freshPositionStrikes = [];

    for (var i = 0; i < chains.length; i++) {
        var c = chains[i];
        var callMissing = c.call != null && (c.call.bid == null || c.call.ask == null || c.call.bid <= 0 || c.call.ask <= 0);
        var putMissing = c.put != null && (c.put.bid == null || c.put.ask == null || c.put.bid <= 0 || c.put.ask <= 0);
        if (callMissing || putMissing) missingQuotes++;
        if ((c.call && c.call.iv == null) || (c.put && c.put.iv == null)) missingIV++;
        var totalVol = ((c.call && c.call.vol) || 0) + ((c.put && c.put.vol) || 0);
        var totalOI = ((c.call && c.call.oi) || 0) + ((c.put && c.put.oi) || 0);
        if (totalVol > totalOI && totalOI > 0 && freshPositionStrikes.length < 10) {
            freshPositionStrikes.push(c.strike);
        }
    }

    var zeroOIExpirations = 0;
    for (var e = 0; e < response.expirations.length; e++) {
        var total = 0;
        var expChains = response.expirations[e].chains;
        for (var j = 0; j < expChains.length; j++) {
            total += ((expChains[j].call && expChains[j].call.oi) || 0) + ((expChains[j].put && expChains[j].put.oi) || 0);
        }
        if (total === 0) zeroOIExpirations++;
    }

    var totalStrikes = chains.length;
    var missingQuotePct = totalStrikes > 0 ? (missingQuotes / totalStrikes) * 100 : 0;
    var missingIVPct = chains.length > 0 ? (missingIV / chains.length) * 100 : 0;
    var wideSpreadFilteredCount = liquidityData.filteredCount;
    var wideSpreadFilteredPct = liquidityData.totalCount > 0
        ? (wideSpreadFilteredCount / liquidityData.totalCount) * 100 : 0;
    var interpolatedPointCount = Math.max(0, volDiag.totalPoints - volDiag.filledPoints);
    var interpolatedPointPct = volDiag.totalPoints > 0
        ? (interpolatedPointCount / volDiag.totalPoints) * 100 : 0;
    var qualityScoreRaw = 100 - missingQuotePct * 0.45 - wideSpreadFilteredPct * 0.35 - interpolatedPointPct * 0.2;
    var qualityScore = _clamp(qualityScoreRaw, 0, 100);
    var qualityGrade = _gradeFromScore(qualityScore);

    return {
        zeroOIExpirations: zeroOIExpirations, missingIVPct: missingIVPct,
        missingQuoteCount: missingQuotes, missingQuotePct: missingQuotePct,
        wideSpreadFilteredCount: wideSpreadFilteredCount, wideSpreadFilteredPct: wideSpreadFilteredPct,
        interpolatedPointCount: interpolatedPointCount, interpolatedPointPct: interpolatedPointPct,
        qualityScore: qualityScore, qualityGrade: qualityGrade,
        oiTimestamp: response.currentDateTime || 'Unknown',
        isPreMarket: false, freshPositionStrikes: freshPositionStrikes, totalStrikes: totalStrikes,
    };
}
`;

export const etlOrchestratorCode = `
function _buildExpiryMetricsRows(response, openingId, symbol, selectionContext) {
    var spot = response.underlyingPrice;
    var multiplier = response.contractMultiplier;
    var rows = [];

    for (var e = 0; e < response.expirations.length; e++) {
        var exp = response.expirations[e];
        var chains = exp.chains;
        if (chains.length === 0) continue;
        var requestDate = _requestDateFromExpiryLabel(exp.label);
        var selectionAnnotation = null;
        if (requestDate != null && selectionContext && selectionContext.byRequestDate) {
            selectionAnnotation = selectionContext.byRequestDate[requestDate] || null;
        }

        var summary = _computeSummaryMetrics(response, exp);
        var gex = _computeGexAnalytics(chains, multiplier, spot, 'mid');
        var em = _computeExpectedMove(chains, spot, exp.daysUntil, exp.label, 'mid');
        var walls = _computeOptionsWalls(chains, multiplier, spot, 'mid');
        var state = _computeStateVector(response, exp, gex, em);
        var term = _computeTermStructure([exp], spot);
        var volSurface = _computeVolSurface([exp], spot);
        var volDiag = _computeVolSurfaceDiagnostics(volSurface);
        var liquidity = _computeLiquidityScore(chains, spot, 0);
        var quality = _computeDataQuality(response, exp, liquidity, volDiag);

        rows.push({
            openingId: openingId, symbol: symbol,
            expiryLabel: exp.label,
            selectionMode: (selectionContext && selectionContext.mode) || null,
            selectionSlot: (selectionAnnotation && selectionAnnotation.slot) || null,
            selectionRank: (selectionAnnotation && selectionAnnotation.rank) || null,
            dte: exp.daysUntil,
            atmStrike: summary.atmStrike,
            atmCallIV: term.length > 0 ? term[0].atmCallIV : null,
            atmPutIV: term.length > 0 ? term[0].atmPutIV : null,
            atmIV: state.atmIV,
            rr25: state.skewMetric,
            expectedMove: em.expectedMove,
            expectedMovePct: em.expectedMovePct,
            totalCallVolume: summary.totalCallVolume,
            totalPutVolume: summary.totalPutVolume,
            pcRatioVolume: summary.pcRatioVolume,
            totalCallOI: summary.totalCallOI,
            totalPutOI: summary.totalPutOI,
            pcRatioOI: summary.pcRatioOI,
            totalNetGex: gex.totalNetGex,
            grossGex: gex.grossGex,
            gammaFlip: gex.flipPoint,
            callWallOIStrike: walls.callWallStrike,
            putWallOIStrike: walls.putWallStrike,
            callWallGexStrike: gex.callWallStrike,
            putWallGexStrike: gex.putWallStrike,
            maxPain: walls.maxPainStrike,
            forwardPrice: state.forward,
            qualityScore: quality.qualityScore,
            missingQuotePct: quality.missingQuotePct,
            missingIVPct: quality.missingIVPct,
        });
    }
    return rows;
}
`;

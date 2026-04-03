export const distributionComputeCode = `
function _computeOIDistribution(chains) {
    return chains.map(function(c) {
        return {
            strike: c.strike,
            callOI: (c.call && c.call.oi) || 0,
            putOI: (c.put && c.put.oi) || 0,
        };
    });
}

function _computeOptionsWalls(chains, multiplier, underlyingPrice, basis, hints) {
    if (!basis) basis = 'mid';
    if (!hints) hints = {};
    var maxPainStrike = hints.maxPainStrike === undefined ? _computeMaxPain(chains) : hints.maxPainStrike;
    var oiByStrike = _computeOIDistribution(chains);
    var gexAnalytics = hints.gexAnalytics || _computeGexAnalytics(chains, multiplier, underlyingPrice, basis);

    var oiWalls = _findWallsAboveBelow(
        oiByStrike,
        function(d) { return d.callOI; },
        function(d) { return d.putOI; },
        underlyingPrice
    );
    var finalCallWallStrike = oiWalls.callWallStrike;
    var finalCallWallOI = oiWalls.callWallVal;
    var finalPutWallStrike = oiWalls.putWallStrike;
    var finalPutWallOI = oiWalls.putWallVal;

    var minIVStrike = null, minIVVal = Infinity;
    for (var i = 0; i < chains.length; i++) {
        var c = chains[i];
        var callIV = c.call && c.call.iv;
        var putIV = c.put && c.put.iv;
        if (callIV != null && putIV != null && callIV > 0 && putIV > 0) {
            var avg = (callIV + putIV) / 2;
            if (avg < minIVVal) { minIVVal = avg; minIVStrike = c.strike; }
        }
    }

    return {
        maxPainStrike: maxPainStrike,
        callWallStrike: finalCallWallStrike, callWallOI: finalCallWallOI,
        putWallStrike: finalPutWallStrike, putWallOI: finalPutWallOI,
        oiByStrike: oiByStrike,
        gammaFlipPoint: gexAnalytics.flipPoint,
        underlyingPrice: underlyingPrice,
        forward: null,
        minIVStrike: minIVStrike,
    };
}
`;

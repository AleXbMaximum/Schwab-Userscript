export const gexComputeCode = `
function _computeGexAnalytics(chains, multiplier, underlyingPrice, basis) {
    if (!basis) basis = 'mid';
    var data = _computeGex(chains, multiplier, underlyingPrice, basis);
    if (!_isSortedByStrike(data)) data.sort(function(a, b) { return a.strike - b.strike; });

    var totalNetGex = 0, grossGex = 0;
    for (var i = 0; i < data.length; i++) {
        totalNetGex += data[i].netGex;
        grossGex += Math.abs(data[i].netGex);
    }

    var walls = _findWallsAboveBelow(
        data,
        function(d) { return d.callGex; },
        function(d) { return Math.abs(d.putGex); },
        underlyingPrice
    );
    var finalCallWallStrike = walls.callWallStrike;
    var finalPutWallStrike = walls.putWallStrike;

    var sorted = data.slice().sort(function(a, b) { return Math.abs(b.netGex) - Math.abs(a.netGex); });
    var topContributors = sorted.slice(0, 5).map(function(d) {
        return { strike: d.strike, netGex: d.netGex, callGex: d.callGex, putGex: d.putGex };
    });

    var FLIP_MIN_MAGNITUDE = 0.01;
    var crossings = [];
    for (var i = 1; i < data.length; i++) {
        var prev = data[i - 1].netGex;
        var curr = data[i].netGex;
        if ((prev >= 0 && curr < 0) || (prev < 0 && curr >= 0)) {
            var avgMag = (Math.abs(prev) + Math.abs(curr)) / 2;
            if (grossGex === 0 || avgMag >= FLIP_MIN_MAGNITUDE * grossGex) {
                var ratio = Math.abs(prev) / (Math.abs(prev) + Math.abs(curr));
                crossings.push(data[i - 1].strike + ratio * (data[i].strike - data[i - 1].strike));
            }
        }
    }

    var flipPoint = null;
    if (crossings.length > 0 && underlyingPrice != null) {
        flipPoint = crossings.reduce(function(best, c) {
            return Math.abs(c - underlyingPrice) < Math.abs(best - underlyingPrice) ? c : best;
        });
    } else if (crossings.length > 0) {
        flipPoint = crossings[0];
    }

    var isPositiveGamma = totalNetGex >= 0;
    if (underlyingPrice != null && data.length > 0) {
        var nearSpot = data.reduce(function(best, d) {
            return Math.abs(d.strike - underlyingPrice) < Math.abs(best.strike - underlyingPrice) ? d : best;
        });
        isPositiveGamma = nearSpot.netGex >= 0;
    }

    return {
        data: data, totalNetGex: totalNetGex, grossGex: grossGex,
        flipPoint: flipPoint, isPositiveGamma: isPositiveGamma,
        callWallStrike: finalCallWallStrike, putWallStrike: finalPutWallStrike,
        gammaPivot: isPositiveGamma ? 'Positive' : 'Negative',
        topContributors: topContributors,
    };
}
`;

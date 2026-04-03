export const volatilityComputeCode = `
function _computeTermStructure(expirations, underlyingPrice) {
    return expirations.map(function(exp) {
        var atmChain = _findATMChain(exp.chains, underlyingPrice);
        var atmCallIV = (atmChain && atmChain.call && atmChain.call.iv) || null;
        var atmPutIV = (atmChain && atmChain.put && atmChain.put.iv) || null;
        var avgIV = atmCallIV != null && atmPutIV != null
            ? (atmCallIV + atmPutIV) / 2
            : (atmCallIV != null ? atmCallIV : atmPutIV);
        return { label: exp.label, daysUntil: exp.daysUntil, atmCallIV: atmCallIV, atmPutIV: atmPutIV, avgIV: avgIV };
    });
}

function _computeVolSurface(expirations, underlyingPrice, maxExpirations) {
    if (maxExpirations == null) maxExpirations = 12;
    var filteredExps = expirations.filter(function(e) { return e.daysUntil <= 365; }).slice(0, maxExpirations);
    if (filteredExps.length === 0 || !underlyingPrice) return { strikes: [], expirations: [], matrix: [] };

    var lower = underlyingPrice * 0.75;
    var upper = underlyingPrice * 1.25;
    var minStrike = Infinity, maxStrike = -Infinity;
    for (var e = 0; e < filteredExps.length; e++) {
        var chains = filteredExps[e].chains;
        for (var c = 0; c < chains.length; c++) {
            if (chains[c].strike >= lower && chains[c].strike <= upper) {
                minStrike = Math.min(minStrike, chains[c].strike);
                maxStrike = Math.max(maxStrike, chains[c].strike);
            }
        }
    }
    if (!isFinite(minStrike)) return { strikes: [], expirations: [], matrix: [] };

    var range = maxStrike - minStrike;
    var bucketWidth = _pickNiceBucketWidth(range, 30);
    var alignedStart = Math.floor(minStrike / bucketWidth) * bucketWidth;
    var alignedEnd = Math.ceil(maxStrike / bucketWidth) * bucketWidth;

    var bucketCenters = [];
    for (var s = alignedStart; s <= alignedEnd; s += bucketWidth) {
        bucketCenters.push(Math.round(s * 100) / 100);
    }
    var numBuckets = bucketCenters.length;
    if (numBuckets === 0) return { strikes: [], expirations: [], matrix: [] };

    var matrix = [];
    var expLabels = [];
    for (var e = 0; e < filteredExps.length; e++) {
        var exp = filteredExps[e];
        expLabels.push({ label: exp.label.split(',')[0], daysUntil: exp.daysUntil });
        var buckets = [];
        for (var b = 0; b < numBuckets; b++) buckets.push({ sum: 0, count: 0 });
        for (var c = 0; c < exp.chains.length; c++) {
            var chain = exp.chains[c];
            if (chain.strike < alignedStart - bucketWidth / 2 || chain.strike > alignedEnd + bucketWidth / 2) continue;
            var idx = Math.min(numBuckets - 1, Math.max(0, Math.round((chain.strike - alignedStart) / bucketWidth)));
            var callIV = (chain.call && chain.call.iv) || null;
            var putIV = (chain.put && chain.put.iv) || null;
            var avg = callIV != null && putIV != null ? (callIV + putIV) / 2 : (callIV != null ? callIV : putIV);
            if (avg != null) { buckets[idx].sum += avg; buckets[idx].count++; }
        }
        matrix.push(buckets.map(function(b) { return b.count > 0 ? b.sum / b.count : null; }));
    }
    return { strikes: bucketCenters, expirations: expLabels, matrix: matrix };
}

function _computeVolSurfaceDiagnostics(surfaceData) {
    var strikes = surfaceData.strikes;
    var expirations = surfaceData.expirations;
    var matrix = surfaceData.matrix;
    var calendarViolations = [];
    var butterflyViolations = [];
    var totalPoints = 0, filledPoints = 0;

    for (var e = 0; e < expirations.length; e++) {
        for (var s = 0; s < strikes.length; s++) {
            totalPoints++;
            if (matrix[e] && matrix[e][s] != null) filledPoints++;
        }
    }

    for (var s = 0; s < strikes.length; s++) {
        for (var e = 1; e < expirations.length; e++) {
            var iv1 = matrix[e - 1] && matrix[e - 1][s];
            var iv2 = matrix[e] && matrix[e][s];
            if (iv1 == null || iv2 == null) continue;
            var t1 = expirations[e - 1].daysUntil / 365;
            var t2 = expirations[e].daysUntil / 365;
            var tv1 = (iv1 / 100) * (iv1 / 100) * t1;
            var tv2 = (iv2 / 100) * (iv2 / 100) * t2;
            if (tv2 < tv1 * 0.98) {
                calendarViolations.push({
                    strike: strikes[s], exp1: expirations[e - 1].label, exp2: expirations[e].label,
                    iv1: iv1, iv2: iv2,
                });
            }
        }
    }

    for (var e = 0; e < expirations.length; e++) {
        for (var s = 1; s < strikes.length - 1; s++) {
            var ivL = matrix[e] && matrix[e][s - 1];
            var ivM = matrix[e] && matrix[e][s];
            var ivR = matrix[e] && matrix[e][s + 1];
            if (ivL == null || ivM == null || ivR == null) continue;
            if (ivL + ivR < 2 * ivM - 0.5) {
                butterflyViolations.push({
                    strike: strikes[s], exp: expirations[e].label,
                    detail: 'IV(' + strikes[s - 1] + ')=' + ivL.toFixed(1) + ' + IV(' + strikes[s + 1] + ')=' + ivR.toFixed(1) + ' < 2*IV(' + strikes[s] + ')=' + (2 * ivM).toFixed(1),
                });
            }
        }
    }

    var missingPointPct = totalPoints > 0 ? ((totalPoints - filledPoints) / totalPoints) * 100 : 0;
    return {
        calendarViolations: calendarViolations, butterflyViolations: butterflyViolations,
        missingPointPct: missingPointPct, totalPoints: totalPoints, filledPoints: filledPoints,
        interpolationMethod: 'Linear (bucketed average)',
    };
}
`;

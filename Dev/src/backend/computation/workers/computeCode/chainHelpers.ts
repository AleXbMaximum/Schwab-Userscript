export const chainHelpersCode = `
function _findATMChain(chains, underlyingPrice) {
    if (!underlyingPrice || chains.length === 0) return null;
    var closest = chains[0];
    var minDiff = Math.abs(chains[0].strike - underlyingPrice);
    for (var i = 1; i < chains.length; i++) {
        var diff = Math.abs(chains[i].strike - underlyingPrice);
        if (diff < minDiff) { minDiff = diff; closest = chains[i]; }
    }
    return closest;
}

function _findATMStrike(chains, underlyingPrice) {
    var atm = _findATMChain(chains, underlyingPrice);
    return atm ? atm.strike : null;
}

function _midPrice(leg) {
    if (!leg) return null;
    if (leg.bid != null && leg.ask != null && leg.bid > 0 && leg.ask > 0) {
        return (leg.bid + leg.ask) / 2;
    }
    if (leg.mark != null && leg.mark > 0) return leg.mark;
    if (leg.last != null && leg.last > 0) return leg.last;
    return null;
}

function _quoteBasisPrice(leg, basis) {
    if (!leg) return null;
    if (basis === 'mark') return leg.mark != null ? leg.mark : _midPrice(leg);
    return _midPrice(leg);
}

function _greekBasisScale(leg, basis) {
    if (!leg) return 1;
    var ref = leg.mark != null ? leg.mark : _midPrice(leg);
    var basisPx = _quoteBasisPrice(leg, basis);
    if (ref == null || basisPx == null || ref <= 0 || basisPx <= 0) return 1;
    return _clamp(basisPx / ref, 0.5, 1.5);
}

function _computeGex(chains, multiplier, underlyingPrice, basis) {
    var spot = underlyingPrice || 0;
    return chains.map(function(c) {
        var callGamma = (c.call && c.call.gamma || 0) * _greekBasisScale(c.call, basis);
        var putGamma = (c.put && c.put.gamma || 0) * _greekBasisScale(c.put, basis);
        var callOI = (c.call && c.call.oi) || 0;
        var putOI = (c.put && c.put.oi) || 0;
        var callGex = callOI * callGamma * spot * spot * multiplier / 100;
        var putGex = -(putOI * putGamma * spot * spot * multiplier / 100);
        return { strike: c.strike, callGex: callGex, putGex: putGex, netGex: callGex + putGex };
    });
}

function _isSortedByStrike(data) {
    for (var i = 1; i < data.length; i++) {
        if (data[i - 1].strike > data[i].strike) return false;
    }
    return true;
}

function _computeMaxPain(chains) {
    if (chains.length === 0) return null;
    var byStrike = {};
    for (var i = 0; i < chains.length; i++) {
        var c = chains[i];
        var key = String(c.strike);
        var row = byStrike[key] || { strike: c.strike, callOI: 0, putOI: 0 };
        row.callOI += (c.call && c.call.oi) || 0;
        row.putOI += (c.put && c.put.oi) || 0;
        byStrike[key] = row;
    }
    var rows = Object.values(byStrike).sort(function(a, b) { return a.strike - b.strike; });
    if (rows.length === 0) return null;
    var n = rows.length;
    var suffixPutOI = new Array(n + 1).fill(0);
    var suffixPutStrikeOI = new Array(n + 1).fill(0);
    for (var i = n - 1; i >= 0; i--) {
        suffixPutOI[i] = suffixPutOI[i + 1] + rows[i].putOI;
        suffixPutStrikeOI[i] = suffixPutStrikeOI[i + 1] + rows[i].putOI * rows[i].strike;
    }
    var prefixCallOI = 0;
    var prefixCallStrikeOI = 0;
    var minPain = Infinity;
    var maxPainStrike = rows[0].strike;
    for (var i = 0; i < n; i++) {
        var strike = rows[i].strike;
        var callPain = strike * prefixCallOI - prefixCallStrikeOI;
        var putPain = suffixPutStrikeOI[i + 1] - strike * suffixPutOI[i + 1];
        var totalPain = (callPain + putPain) * 100;
        if (totalPain < minPain) { minPain = totalPain; maxPainStrike = strike; }
        prefixCallOI += rows[i].callOI;
        prefixCallStrikeOI += rows[i].callOI * strike;
    }
    return maxPainStrike;
}

function _filterChainsAroundATM(chains, underlyingPrice, range) {
    if (range == null) range = 40;
    if (!underlyingPrice || chains.length === 0) return chains;
    var lower = underlyingPrice * (1 - range / 100);
    var upper = underlyingPrice * (1 + range / 100);
    return chains.filter(function(c) { return c.strike >= lower && c.strike <= upper; });
}

function _pickSpread(arr, count) {
    if (arr.length <= count) return arr;
    var result = [];
    for (var i = 0; i < count; i++) {
        var idx = Math.round((i / (count - 1)) * (arr.length - 1));
        result.push(arr[idx]);
    }
    return result;
}

function _spreadPct(bid, ask) {
    if (bid == null || ask == null || bid <= 0) return null;
    var mid = (bid + ask) / 2;
    return mid > 0 ? ((ask - bid) / mid) * 100 : null;
}

function _gradeFromSpreadPct(pct) {
    if (pct == null) return 'F';
    if (pct < 1) return 'A';
    if (pct < 2) return 'B';
    if (pct < 5) return 'C';
    if (pct < 10) return 'D';
    return 'F';
}

function _gradeFromScore(score) {
    if (score >= 90) return 'A';
    if (score >= 75) return 'B';
    if (score >= 60) return 'C';
    if (score >= 45) return 'D';
    return 'F';
}

function _findWallsAboveBelow(data, callValueFn, putValueFn, underlyingPrice, sideThreshold) {
    if (sideThreshold == null) sideThreshold = 0.4;
    var callWallStrike = null, callWallVal = 0;
    var callWallAboveStrike = null, callWallAboveVal = 0;
    var putWallStrike = null, putWallVal = 0;
    var putWallBelowStrike = null, putWallBelowVal = 0;

    for (var i = 0; i < data.length; i++) {
        var d = data[i];
        var cv = callValueFn(d);
        var pv = putValueFn(d);
        if (cv > callWallVal) { callWallVal = cv; callWallStrike = d.strike; }
        if ((underlyingPrice == null || d.strike >= underlyingPrice) && cv > callWallAboveVal) {
            callWallAboveVal = cv; callWallAboveStrike = d.strike;
        }
        if (pv > putWallVal) { putWallVal = pv; putWallStrike = d.strike; }
        if ((underlyingPrice == null || d.strike <= underlyingPrice) && pv > putWallBelowVal) {
            putWallBelowVal = pv; putWallBelowStrike = d.strike;
        }
    }

    var finalCallStrike = callWallAboveStrike != null && callWallAboveVal >= sideThreshold * callWallVal
        ? callWallAboveStrike : callWallStrike;
    var finalCallVal = finalCallStrike === callWallAboveStrike ? callWallAboveVal : callWallVal;
    var finalPutStrike = putWallBelowStrike != null && putWallBelowVal >= sideThreshold * putWallVal
        ? putWallBelowStrike : putWallStrike;
    var finalPutVal = finalPutStrike === putWallBelowStrike ? putWallBelowVal : putWallVal;

    return {
        callWallStrike: finalCallStrike, callWallVal: finalCallVal,
        putWallStrike: finalPutStrike, putWallVal: finalPutVal,
    };
}

function _computeForwardPrice(spot, rate, divYield, daysUntil) {
    if (spot == null || spot <= 0) return null;
    var r = (rate || 0) / 100;
    var q = (divYield || 0) / 100;
    var T = daysUntil / 365;
    return spot * Math.exp((r - q) * T);
}

function _compute25DeltaRR(chains) {
    var call25 = null;
    var put25 = null;
    for (var i = 0; i < chains.length; i++) {
        var c = chains[i];
        if (c.call && c.call.delta != null && c.call.iv != null) {
            var diff = Math.abs(c.call.delta - 0.25);
            if (!call25 || diff < call25.diff) call25 = { iv: c.call.iv, diff: diff };
        }
        if (c.put && c.put.delta != null && c.put.iv != null) {
            var diff = Math.abs(c.put.delta - (-0.25));
            if (!put25 || diff < put25.diff) put25 = { iv: c.put.iv, diff: diff };
        }
    }
    if (!call25 || !put25) return null;
    return call25.iv - put25.iv;
}
`;

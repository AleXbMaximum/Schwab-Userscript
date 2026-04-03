export const holdingsParserCode = `
// ── holdingsParser.ts ────────────────────────────────────────────
function _isParsedValueWrapper(v) {
    return (
        v != null &&
        typeof v === 'object' &&
        'parsedValue' in v &&
        typeof v.parsedValue === 'number'
    );
}

function _flattenParsedValuesDeepInPlace(obj) {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
        for (var i = 0; i < obj.length; i++) {
            var v = obj[i];
            if (_isParsedValueWrapper(v)) {
                obj[i] = v.parsedValue;
            } else {
                _flattenParsedValuesDeepInPlace(v);
            }
        }
        return;
    }
    for (var k in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
        var val = obj[k];
        if (_isParsedValueWrapper(val)) {
            obj[k] = val.parsedValue;
        } else {
            _flattenParsedValuesDeepInPlace(val);
        }
    }
}

var TOTAL_PERCENT_KEYS = [
    'dayChangePercent',
    'gainLossPercent',
    'percentageOfAccount',
    'pctOfAcct',
    'pctOfAccount',
    'totalDayChangePercent',
];

function _normalizeNumberCellPercentInPlace(cell) {
    if (!cell || typeof cell !== 'object') return;
    var ratio = _pctPointsToRatio(cell.val);
    if (ratio == null) return;
    cell.val = ratio;
}

function _normalizeTotalsPercentFieldsInPlace(totals) {
    if (!totals || typeof totals !== 'object') return;
    for (var i = 0; i < TOTAL_PERCENT_KEYS.length; i++) {
        var k = TOTAL_PERCENT_KEYS[i];
        var ratio = _pctPointsToRatio(totals[k]);
        if (ratio == null) continue;
        totals[k] = ratio;
    }
}

function _normalizeRowPercentFieldsInPlace(row) {
    if (!row || typeof row !== 'object') return;
    _normalizeNumberCellPercentInPlace(row.priceChngPrc);
    _normalizeNumberCellPercentInPlace(row.dayChngPerc);
    _normalizeNumberCellPercentInPlace(row.pctOfAcct);
    var gl = row.gainLoss;
    if (gl && typeof gl === 'object') {
        var ratio = _pctPointsToRatio(gl.gainLossPct);
        if (ratio != null) gl.gainLossPct = ratio;
    }
    _normalizeNumberCellPercentInPlace(row.dividendYield);
    _normalizeNumberCellPercentInPlace(row.divYield);
    if (Array.isArray(row.childRows)) {
        for (var i = 0; i < row.childRows.length; i++) {
            _normalizeRowPercentFieldsInPlace(row.childRows[i]);
        }
    }
}

function _shouldNormalizeHoldingsPercentPoints(holdings) {
    if (!holdings) return false;
    function hasEvidence(v) {
        return typeof v === 'number' && Number.isFinite(v) && Math.abs(v) > 1;
    }
    var accounts = holdings.accounts || [];
    for (var a = 0; a < accounts.length; a++) {
        var acct = accounts[a];
        var acctTotals = acct.totals;
        if (acctTotals && hasEvidence(acctTotals.dayChangePercent)) return true;
        if (acctTotals && hasEvidence(acctTotals.gainLossPercent)) return true;
        if (acctTotals && hasEvidence(acctTotals.percentageOfAccount)) return true;
        var groups = acct.groupedPositions || [];
        for (var g = 0; g < groups.length; g++) {
            var group = groups[g];
            var totals = group.totals;
            if (totals && hasEvidence(totals.percentageOfAccount)) return true;
            var rows = group.holdingsRows || [];
            for (var r = 0; r < rows.length; r++) {
                var row = rows[r];
                var p = row.pctOfAcct;
                if (p && typeof p === 'object' && hasEvidence(p.val)) return true;
                var glPct = row.gainLoss ? row.gainLoss.gainLossPct : undefined;
                if (hasEvidence(glPct)) return true;
                var prc = row.priceChngPrc ? row.priceChngPrc.val : undefined;
                if (hasEvidence(prc)) return true;
                var day = row.dayChngPerc ? row.dayChngPerc.val : undefined;
                if (hasEvidence(day)) return true;
            }
        }
    }
    return false;
}

function _parseHoldingsResponse(payload) {
    var holdings = payload;
    _flattenParsedValuesDeepInPlace(holdings);
    var shouldNormalizePct = _shouldNormalizeHoldingsPercentPoints(holdings);
    if (shouldNormalizePct) {
        _normalizeTotalsPercentFieldsInPlace(holdings.accountTotals);
        var accounts = holdings.accounts || [];
        for (var a = 0; a < accounts.length; a++) {
            var acct = accounts[a];
            _normalizeTotalsPercentFieldsInPlace(acct.totals);
            var groups = acct.groupedPositions || [];
            for (var g = 0; g < groups.length; g++) {
                var group = groups[g];
                _normalizeTotalsPercentFieldsInPlace(group.totals);
                var rows = group.holdingsRows || [];
                for (var r = 0; r < rows.length; r++) {
                    _normalizeRowPercentFieldsInPlace(rows[r]);
                }
            }
        }
    }
    _normalizeNumbersDeepInPlace(holdings, 6);
    return holdings;
}
`;

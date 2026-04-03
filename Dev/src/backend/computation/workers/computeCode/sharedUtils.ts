export const sharedUtilsCode = `
// ── numberNormalizer.ts ──────────────────────────────────────────
function _roundToDecimals(n, decimals) {
    var p = Math.pow(10, decimals);
    var rounded = Math.round(n * p) / p;
    return Object.is(rounded, -0) ? 0 : rounded;
}

function _shouldRound(v) {
    return typeof v === 'number' && Number.isFinite(v) && !Number.isInteger(v);
}

function _normalizeNumbersDeepInPlace(obj, decimals) {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
        for (var i = 0; i < obj.length; i++) {
            var v = obj[i];
            if (_shouldRound(v)) obj[i] = _roundToDecimals(v, decimals);
            else _normalizeNumbersDeepInPlace(v, decimals);
        }
        return;
    }
    for (var k in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
        var val = obj[k];
        if (_shouldRound(val)) obj[k] = _roundToDecimals(val, decimals);
        else _normalizeNumbersDeepInPlace(val, decimals);
    }
}

// ── numberParsers.ts ─────────────────────────────────────────────
function _toFiniteNumberOrNull(v) {
    if (v == null) return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v === 'string') {
        if (v.length === 0) return null;
        var n = Number(v);
        if (Number.isFinite(n)) return n;
        var parsed = parseFloat(v);
        return Number.isFinite(parsed) ? parsed : null;
    }
    var fallback = parseFloat(String(v));
    return Number.isFinite(fallback) ? fallback : null;
}

function _toFiniteNumberOrNullNoSentinel(v) {
    if (v === -999 || v === '-999') return null;
    return _toFiniteNumberOrNull(v);
}

function _pctPointsToRatio(v) {
    var n = _toFiniteNumberOrNull(v);
    return n == null ? null : n / 100;
}
`;

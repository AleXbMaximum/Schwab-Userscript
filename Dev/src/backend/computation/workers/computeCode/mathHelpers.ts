export const mathHelpersCode = `
function _clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function _pickNiceBucketWidth(range, maxCols) {
    var niceSteps = [0.5, 1, 2.5, 5, 10, 25, 50, 100];
    for (var i = 0; i < niceSteps.length; i++) {
        if (range / niceSteps[i] <= maxCols) return niceSteps[i];
    }
    return niceSteps[niceSteps.length - 1];
}

function _mathMean(arr) {
    if (arr.length === 0) return 0;
    var sum = 0;
    for (var i = 0; i < arr.length; i++) sum += arr[i];
    return sum / arr.length;
}

function _mathVariance(arr, preMean) {
    var n = arr.length;
    if (n < 1) return 0;
    var m = preMean !== undefined ? preMean : _mathMean(arr);
    var sumSq = 0;
    for (var i = 0; i < n; i++) {
        var d = arr[i] - m;
        sumSq += d * d;
    }
    return sumSq / n;
}

function _mathCovariance(a, b, preMeanA, preMeanB) {
    var n = Math.min(a.length, b.length);
    if (n === 0) return 0;
    var mA = preMeanA !== undefined ? preMeanA : _mathMean(a.length > n ? a.slice(0, n) : a);
    var mB = preMeanB !== undefined ? preMeanB : _mathMean(b.length > n ? b.slice(0, n) : b);
    var cov = 0;
    for (var i = 0; i < n; i++) cov += (a[i] - mA) * (b[i] - mB);
    return cov / n;
}

function _meanRange(arr, start, end) {
    var sum = 0;
    for (var i = start; i < end; i++) sum += arr[i];
    return sum / (end - start);
}

function _covVarRange(a, b, start, end, mA, mB) {
    var cov = 0, varA = 0, varB = 0;
    var n = end - start;
    for (var i = start; i < end; i++) {
        var da = a[i] - mA;
        var db = b[i] - mB;
        cov += da * db;
        varA += da * da;
        varB += db * db;
    }
    return { cov: cov / n, varA: varA / n, varB: varB / n };
}

function _toPositiveInt(value, fallback) {
    if (typeof value !== 'number' || !isFinite(value)) return fallback;
    return Math.max(1, Math.floor(value));
}
`;

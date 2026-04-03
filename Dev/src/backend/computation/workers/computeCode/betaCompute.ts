export const betaComputeCode = `
function _logReturns(closes) {
    var out = [];
    for (var i = 1; i < closes.length; i++) {
        if (closes[i - 1] > 0 && closes[i] > 0) {
            out.push(Math.log(closes[i] / closes[i - 1]));
        }
    }
    return out;
}

var _ET_FORMAT = null;
function _getETFormat() {
    if (!_ET_FORMAT) {
        _ET_FORMAT = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York',
            weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
        });
    }
    return _ET_FORMAT;
}

function _isRegularSessionBar(date) {
    if (date.indexOf('T') < 0) return true;
    var dt = new Date(date);
    if (isNaN(dt.getTime())) return false;
    var parts = _getETFormat().formatToParts(dt);
    var weekday = '', hour = -1, minute = -1;
    for (var i = 0; i < parts.length; i++) {
        if (parts[i].type === 'weekday') weekday = parts[i].value;
        if (parts[i].type === 'hour') hour = Number(parts[i].value);
        if (parts[i].type === 'minute') minute = Number(parts[i].value);
    }
    if (weekday === 'Sat' || weekday === 'Sun') return false;
    if (!isFinite(hour) || !isFinite(minute)) return false;
    var hhmm = hour * 60 + minute;
    return hhmm >= 570 && hhmm <= 960;
}

function _sanitizeBars(bars) {
    var dedup = {};
    for (var i = 0; i < bars.length; i++) {
        var bar = bars[i];
        if (!bar || !bar.date) continue;
        if (typeof bar.close !== 'number' || !isFinite(bar.close) || bar.close <= 0) continue;
        if (!_isRegularSessionBar(bar.date)) continue;
        dedup[bar.date] = { date: bar.date, close: bar.close };
    }
    return Object.values(dedup).sort(function(a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
}

function _alignBarsByDate(stockBars, marketBars) {
    var cleanStock = _sanitizeBars(stockBars);
    var cleanMarket = _sanitizeBars(marketBars);
    var marketMap = {};
    for (var i = 0; i < cleanMarket.length; i++) marketMap[cleanMarket[i].date] = cleanMarket[i].close;
    var stockCloses = [], marketCloses = [], dates = [];
    for (var i = 0; i < cleanStock.length; i++) {
        var mClose = marketMap[cleanStock[i].date];
        if (mClose != null && cleanStock[i].close > 0 && mClose > 0) {
            stockCloses.push(cleanStock[i].close);
            marketCloses.push(mClose);
            dates.push(cleanStock[i].date);
        }
    }
    return { stockCloses: stockCloses, marketCloses: marketCloses, dates: dates };
}

function _computeBetaOLS(stockReturns, marketReturns, horizon) {
    var n = Math.min(stockReturns.length, marketReturns.length);
    if (n < 10) return null;
    var sr = stockReturns.length > n ? stockReturns.slice(0, n) : stockReturns;
    var mr = marketReturns.length > n ? marketReturns.slice(0, n) : marketReturns;
    var meanS = _mathMean(sr);
    var meanM = _mathMean(mr);
    var cov = _mathCovariance(sr, mr, meanS, meanM);
    var varM = _mathVariance(mr, meanM);
    var varS = _mathVariance(sr, meanS);
    if (varM === 0) return null;
    var beta = cov / varM;
    var correlation = varS > 0 ? cov / Math.sqrt(varM * varS) : 0;
    var alpha = meanS - beta * meanM;
    var rSquared = correlation * correlation;
    return {
        beta: Math.round(beta * 1000) / 1000,
        correlation: Math.round(correlation * 1000) / 1000,
        alpha: Math.round(alpha * 10000) / 10000,
        rSquared: Math.round(rSquared * 1000) / 1000,
        sampleSize: n, horizon: horizon,
        computedAt: new Date().toISOString(),
    };
}

function _computeBetaRange(stockReturns, marketReturns, start, end, horizon) {
    var n = end - start;
    if (n < 10) return null;
    var meanS = _meanRange(stockReturns, start, end);
    var meanM = _meanRange(marketReturns, start, end);
    var cv = _covVarRange(stockReturns, marketReturns, start, end, meanS, meanM);
    if (cv.varB === 0) return null;
    var beta = cv.cov / cv.varB;
    var correlation = cv.varA > 0 ? cv.cov / Math.sqrt(cv.varB * cv.varA) : 0;
    var alpha = meanS - beta * meanM;
    var rSquared = correlation * correlation;
    return {
        beta: Math.round(beta * 1000) / 1000,
        correlation: Math.round(correlation * 1000) / 1000,
        alpha: Math.round(alpha * 10000) / 10000,
        rSquared: Math.round(rSquared * 1000) / 1000,
        sampleSize: n, horizon: horizon,
        computedAt: new Date().toISOString(),
    };
}

function _smoothRollingBeta(points, smoothingWindow) {
    if (points.length === 0) return [];
    if (smoothingWindow <= 1) return points;
    if (points.length < smoothingWindow) return [];
    var out = [];
    var sumBeta = 0;
    var sumCorr = 0;
    for (var i = 0; i < points.length; i++) {
        sumBeta += points[i].beta;
        sumCorr += points[i].correlation;
        if (i >= smoothingWindow) {
            sumBeta -= points[i - smoothingWindow].beta;
            sumCorr -= points[i - smoothingWindow].correlation;
        }
        if (i >= smoothingWindow - 1) {
            out.push({
                date: points[i].date,
                beta: Math.round((sumBeta / smoothingWindow) * 1000) / 1000,
                correlation: Math.round((sumCorr / smoothingWindow) * 1000) / 1000,
            });
        }
    }
    return out;
}

function _sampleRollingBeta(points, step) {
    if (points.length <= 1 || step <= 1) return points;
    var out = [];
    for (var i = 0; i < points.length; i += step) out.push(points[i]);
    var last = points[points.length - 1];
    if (out[out.length - 1].date !== last.date) out.push(last);
    return out;
}

function _computeRollingBeta(stockBars, marketBars, windowSize, options) {
    var aligned = _alignBarsByDate(stockBars, marketBars);
    var stockReturns = _logReturns(aligned.stockCloses);
    var marketReturns = _logReturns(aligned.marketCloses);
    var returnDates = aligned.dates.slice(1);
    var alignedReturnCount = Math.min(stockReturns.length, marketReturns.length, returnDates.length);
    var minWindowPoints = _toPositiveInt(options && options.minWindowPoints, 50);
    var effectiveWindow = Math.max(_toPositiveInt(windowSize, 10), minWindowPoints);
    if (alignedReturnCount < effectiveWindow) return [];
    var rollingHorizon = (options && options.horizon) || 'short';
    var rawPoints = [];
    for (var i = effectiveWindow; i <= alignedReturnCount; i++) {
        var res = _computeBetaRange(stockReturns, marketReturns, i - effectiveWindow, i, rollingHorizon);
        if (res) rawPoints.push({ date: returnDates[i - 1], beta: res.beta, correlation: res.correlation });
    }
    if (rawPoints.length === 0) return [];
    var smoothingWindow = _toPositiveInt(options && options.smoothingWindow, 10);
    var smoothed = _smoothRollingBeta(rawPoints, smoothingWindow);
    var samplingStep = _toPositiveInt(options && options.samplingStep, 1);
    return _sampleRollingBeta(smoothed, samplingStep);
}

function _computeBetaFromBars(stockBars, marketBars, horizon) {
    var aligned = _alignBarsByDate(stockBars, marketBars);
    var stockReturns = _logReturns(aligned.stockCloses);
    var marketReturns = _logReturns(aligned.marketCloses);
    return _computeBetaOLS(stockReturns, marketReturns, horizon);
}
`;

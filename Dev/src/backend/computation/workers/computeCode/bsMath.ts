export const bsMathCode = `
function _normalPDF(x) {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

function _normalCDF(x) {
    var a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
    var a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
    var sign = x < 0 ? -1 : 1;
    var absX = Math.abs(x) / Math.SQRT2;
    var t = 1.0 / (1.0 + p * absX);
    var y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
    return 0.5 * (1.0 + sign * y);
}

function _blackScholesGamma(spot, strike, T, r, sigma, q) {
    if (T <= 0 || sigma <= 0 || spot <= 0 || strike <= 0) return 0;
    var sqrtT = Math.sqrt(T);
    var sigmaSqrtT = sigma * sqrtT;
    var d1 = (Math.log(spot / strike) + (r - q + 0.5 * sigma * sigma) * T) / sigmaSqrtT;
    var eNegQT = Math.exp(-q * T);
    return (eNegQT * _normalPDF(d1)) / (spot * sigmaSqrtT);
}

function _computeBSGex(chains, spot, riskFreeRate, daysToExpiry, multiplier, dividendYield) {
    var T = daysToExpiry / 365;
    var q = dividendYield || 0;
    if (T <= 0 || spot <= 0) return [];

    return chains.map(function(chain) {
        var callIV = (chain.call && chain.call.iv) || 0;
        var putIV = (chain.put && chain.put.iv) || 0;
        var iv = (callIV > 0 && putIV > 0)
            ? (callIV + putIV) / 2
            : (callIV > 0 ? callIV : putIV);

        if (iv <= 0) {
            return { strike: chain.strike, callGex: 0, putGex: 0, netGex: 0 };
        }

        var gamma = _blackScholesGamma(spot, chain.strike, T, riskFreeRate, iv, q);
        var callOI = (chain.call && chain.call.oi) || 0;
        var putOI = (chain.put && chain.put.oi) || 0;
        var gexFactor = gamma * spot * spot * multiplier / 100;
        var callGex = callOI * gexFactor;
        var putGex = -(putOI * gexFactor);

        return { strike: chain.strike, callGex: callGex, putGex: putGex, netGex: callGex + putGex };
    });
}
`;

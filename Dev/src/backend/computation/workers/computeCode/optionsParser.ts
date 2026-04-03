export const optionsParserCode = `
var _SENTINEL_MIN = -900;

function _parseNullableMetric(v) {
    var n = _toFiniteNumberOrNull(v);
    if (n == null || n <= _SENTINEL_MIN) return null;
    return n;
}

function _parseNonNegativeMetric(v) {
    var n = _toFiniteNumberOrNull(v);
    if (n == null || n <= _SENTINEL_MIN || n < 0) return null;
    return n;
}

function _parseLeg(raw, optionType) {
    if (!raw || typeof raw !== 'object') return null;
    var strike = _toFiniteNumberOrNull(raw.Strk);
    if (strike == null) return null;
    return {
        sym: raw.Sym == null ? '' : String(raw.Sym),
        optionType: optionType,
        strike: strike,
        bid: _parseNullableMetric(raw.Bid),
        ask: _parseNullableMetric(raw.Ask),
        last: _parseNullableMetric(raw.Lst),
        mark: _parseNullableMetric(raw.Mark),
        vol: _parseNonNegativeMetric(raw.Vol),
        oi: _parseNonNegativeMetric(raw.OI),
        iv: _parseNonNegativeMetric(raw.IV),
        delta: _parseNullableMetric(raw.Delta),
        gamma: _parseNullableMetric(raw.Gamma),
        theta: _parseNullableMetric(raw.Theta),
        vega: _parseNullableMetric(raw.Vega),
        rho: _parseNullableMetric(raw.Rho),
        intrinsic: _parseNullableMetric(raw.Intrinsic),
        extrinsic: _parseNullableMetric(raw.Extrinsic),
        theoVal: _parseNullableMetric(raw.TheoVal),
        change: _parseNullableMetric(raw.Chg),
        changePct: _parseNullableMetric(raw.ChgPct),
        bidSize: _parseNonNegativeMetric(raw.BidSize),
        askSize: _parseNonNegativeMetric(raw.AskSize),
        high: _parseNullableMetric(raw.High),
        low: _parseNullableMetric(raw.Low),
    };
}

function _parseChain(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var legs = Array.isArray(raw.Legs) ? raw.Legs : [];
    var call = null;
    var put = null;
    for (var i = 0; i < legs.length; i++) {
        var legRaw = legs[i];
        if (!legRaw || typeof legRaw !== 'object') continue;
        if (legRaw.OptionType === 'P') {
            if (put == null) put = _parseLeg(legRaw, 'P');
        } else {
            if (call == null) call = _parseLeg(legRaw, 'C');
        }
        if (call != null && put != null) break;
    }
    var strike = (call && call.strike) || (put && put.strike);
    if (strike == null) return null;
    return {
        strike: strike,
        symbolGroup: raw.SymbolGroup == null ? '' : String(raw.SymbolGroup),
        call: call,
        put: put,
    };
}

function _parseExpiration(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var group = raw.ExpirationGroup;
    if (!group) return null;
    var daysUntil = _toFiniteNumberOrNull(group.DaysUntil);
    var monthAndDay = String(group.MonthAndDay || '');
    var year = String(group.Year || '');
    var day = String(group.Day || '');
    var label = monthAndDay + ', ' + year + ' (' + day + ')';
    var rawChains = Array.isArray(raw.Chains) ? raw.Chains : [];
    var chains = new Array(rawChains.length);
    var chainCount = 0;
    for (var i = 0; i < rawChains.length; i++) {
        var parsed = _parseChain(rawChains[i]);
        if (parsed) {
            chains[chainCount] = parsed;
            chainCount += 1;
        }
    }
    if (chainCount === 0) return null;
    chains.length = chainCount;
    return {
        rootSymbol: String(group.RootSymbol || ''),
        label: label,
        year: year,
        daysUntil: daysUntil || 0,
        expirationType: String(group.ExpirationType || ''),
        chains: chains,
    };
}

function _parseUnderlyingData(raw) {
    var u = (raw && raw.UnderlyingData) || {};
    return {
        symbol: String(u.Symbol || ''),
        description: String(u.Description || ''),
        bid: _toFiniteNumberOrNull(u.Bid),
        ask: _toFiniteNumberOrNull(u.Ask),
        last: _toFiniteNumberOrNull(u.Last),
        close: _toFiniteNumberOrNull(u.Close),
        open: _toFiniteNumberOrNull(u.Open),
        dailyHigh: _toFiniteNumberOrNull(u.DailyHigh),
        dailyLow: _toFiniteNumberOrNull(u.DailyLow),
        high52W: _toFiniteNumberOrNull(u.High52W),
        low52W: _toFiniteNumberOrNull(u.Low52W),
        volume: _toFiniteNumberOrNull(u.CumulativeVolume),
        netChange: _toFiniteNumberOrNull(u.NetChange),
        percentChange: _toFiniteNumberOrNull(u.PercentChange),
    };
}

function _createEmptyResponse() {
    return {
        underlying: {
            symbol: '', description: '', bid: null, ask: null, last: null,
            close: null, open: null, dailyHigh: null, dailyLow: null,
            high52W: null, low52W: null, volume: null, netChange: null,
            percentChange: null,
        },
        expirations: [],
        underlyingPrice: null,
        interestRate: null,
        volatility: null,
        dividendYield: null,
        contractMultiplier: 100,
        currentDateTime: '',
        isDelayed: false,
    };
}

function _parseOptionChainsResponse(raw) {
    if (!raw || typeof raw !== 'object') return _createEmptyResponse();
    var underlying = _parseUnderlyingData(raw);
    var rawExpirations = Array.isArray(raw.Expirations) ? raw.Expirations : [];
    var expirations = new Array(rawExpirations.length);
    var expirationCount = 0;
    for (var i = 0; i < rawExpirations.length; i++) {
        var parsed = _parseExpiration(rawExpirations[i]);
        if (parsed) {
            expirations[expirationCount] = parsed;
            expirationCount += 1;
        }
    }
    expirations.length = expirationCount;
    var multi = _toFiniteNumberOrNull(raw.ContractSpecs && raw.ContractSpecs.Multi);
    return {
        underlying: underlying,
        expirations: expirations,
        underlyingPrice: _toFiniteNumberOrNull(raw.UnderlyingPrice),
        interestRate: _toFiniteNumberOrNull(raw.InterestRate),
        volatility: _toFiniteNumberOrNull(raw.Volatility),
        dividendYield: _toFiniteNumberOrNull(raw.DividendYield),
        contractMultiplier: multi != null ? multi : 100,
        currentDateTime: String(raw.CurrentDateTime || ''),
        isDelayed: Boolean(raw.IsDelayed),
    };
}
`;

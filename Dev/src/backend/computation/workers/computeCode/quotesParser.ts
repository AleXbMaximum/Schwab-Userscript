export const quotesParserCode = `
function _parseSerPdfIdFromDockey(dockey) {
    var parts = dockey.split('-');
    if (parts.length < 2) return null;
    var n = Number(parts[1]);
    return Number.isFinite(n) ? n : null;
}

function _extractSerPdfId(serPdf) {
    if (typeof serPdf !== 'string' || !serPdf) return null;
    try {
        var u = new URL(serPdf);
        var dockey = u.searchParams.get('Dockey');
        if (dockey) {
            var id = _parseSerPdfIdFromDockey(dockey);
            if (id != null) return id;
        }
    } catch (e) {}
    var match = /Dockey=([^&]+)/.exec(serPdf);
    if (match && match[1]) {
        var id = _parseSerPdfIdFromDockey(match[1]);
        if (id != null) return id;
    }
    return null;
}

function _parseQuotesResponse(payload) {
    var resp = payload && typeof payload === 'object' ? payload : {};
    var rawQuotes = Array.isArray(resp.quotes) ? resp.quotes : [];
    var quotes = [];

    for (var i = 0; i < rawQuotes.length; i++) {
        var item = rawQuotes[i];
        if (!item) continue;
        var reference = item.reference;
        var quote = item.quote;
        var regularQuote = item.regularQuote;
        var marketType = item.marketType;
        var serPdf = item.fundamental && item.fundamental.serPdf;
        var serPdfId = _extractSerPdfId(serPdf);

        if (!reference || typeof reference !== 'object') continue;
        if (!quote || typeof quote !== 'object') continue;

        var pct = _toFiniteNumberOrNull(quote.netChangePercent);
        if (pct != null) quote.netChangePercent = pct / 100;
        var pmPct = _toFiniteNumberOrNull(quote.postMarketPercentChange);
        if (pmPct != null) quote.postMarketPercentChange = pmPct / 100;
        if (regularQuote && typeof regularQuote === 'object') {
            var rPct = _toFiniteNumberOrNull(regularQuote.percentChange);
            if (rPct != null) regularQuote.percentChange = rPct / 100;
        }

        quotes.push({
            reference: reference, quote: quote, regularQuote: regularQuote,
            marketType: typeof marketType === 'string' ? marketType : undefined,
            serPdfId: serPdfId,
        });
    }

    var out = { quotes: quotes };
    _normalizeNumbersDeepInPlace(out, 6);
    return out;
}
`;

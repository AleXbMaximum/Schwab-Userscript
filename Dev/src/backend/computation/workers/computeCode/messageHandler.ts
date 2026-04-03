export const messageHandlerCode = `
self.onmessage = function(e) {
    var msg = e.data;
    var id = msg.id;
    try {
        var result;
        switch (msg.task) {
            case 'parseHoldings':
                result = _parseHoldingsResponse(msg.rawJson);
                break;
            case 'parseOptionsChain':
                result = _parseOptionChainsResponse(msg.rawJson);
                break;
            case 'processOptionsChain':
                var parsed = _parseOptionChainsResponse(msg.rawJson);
                var selCtx = msg.selectionContext || null;
                var etlRows = _buildExpiryMetricsRows(parsed, msg.openingId, msg.symbol, selCtx);
                result = { parsed: parsed, etlRows: etlRows };
                break;
            case 'buildExpiryMetrics':
                var selCtx2 = msg.selectionContext || null;
                result = _buildExpiryMetricsRows(msg.parsedResponse, msg.openingId, msg.symbol, selCtx2);
                break;
            case 'parseQuotes':
                result = _parseQuotesResponse(msg.rawJson);
                break;
            case 'computeBeta':
                result = _computeBetaFromBars(msg.stockBars, msg.marketBars, msg.horizon);
                break;
            case 'computeRollingBeta':
                result = _computeRollingBeta(msg.stockBars, msg.marketBars, msg.windowSize, msg.options);
                break;
            default:
                throw new Error('Unknown task: ' + msg.task);
        }
        self.postMessage({ id: id, result: result });
    } catch (err) {
        self.postMessage({ id: id, error: String(err && err.message || err) });
    }
};
`;

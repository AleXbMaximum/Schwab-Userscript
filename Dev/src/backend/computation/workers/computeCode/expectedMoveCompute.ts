export const expectedMoveComputeCode = `
function _computeExpectedMove(chains, underlyingPrice, daysUntil, expLabel, basis) {
    if (!basis) basis = 'mid';
    var atm = _findATMStrike(chains, underlyingPrice);
    if (!atm || !underlyingPrice) {
        return {
            atmStrike: null, atmCallPrice: null, atmPutPrice: null,
            straddlePrice: null, expectedMove: null, expectedMovePct: null,
            upperBound1Sigma: null, lowerBound1Sigma: null,
            upperBound2Sigma: null, lowerBound2Sigma: null,
            daysUntil: daysUntil, expLabel: expLabel,
        };
    }
    var atmChain = null;
    for (var i = 0; i < chains.length; i++) {
        if (chains[i].strike === atm) { atmChain = chains[i]; break; }
    }
    var callMark = _quoteBasisPrice(atmChain && atmChain.call, basis);
    var putMark = _quoteBasisPrice(atmChain && atmChain.put, basis);
    var straddlePrice = callMark != null && putMark != null ? callMark + putMark : null;
    var expectedMove = straddlePrice != null ? 0.85 * straddlePrice : null;
    var expectedMovePct = expectedMove != null && underlyingPrice > 0
        ? (expectedMove / underlyingPrice) * 100 : null;
    return {
        atmStrike: atm, atmCallPrice: callMark, atmPutPrice: putMark,
        straddlePrice: straddlePrice, expectedMove: expectedMove, expectedMovePct: expectedMovePct,
        upperBound1Sigma: expectedMove != null ? underlyingPrice + expectedMove : null,
        lowerBound1Sigma: expectedMove != null ? underlyingPrice - expectedMove : null,
        upperBound2Sigma: expectedMove != null ? underlyingPrice + expectedMove * 2 : null,
        lowerBound2Sigma: expectedMove != null ? underlyingPrice - expectedMove * 2 : null,
        daysUntil: daysUntil, expLabel: expLabel,
    };
}
`;

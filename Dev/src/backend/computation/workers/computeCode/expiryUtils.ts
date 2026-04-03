export const expiryUtilsCode = `
var _MONTH_MAP = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function _parseExpiryLabelToYmd(label) {
    if (!label) return null;
    var m = String(label).trim().match(/^([A-Za-z]+)\\s+(\\d{1,2}),\\s*(\\d{4})/);
    if (!m) return null;
    var month = _MONTH_MAP[m[1].slice(0, 3).toLowerCase()];
    var day = parseInt(m[2], 10);
    var year = parseInt(m[3], 10);
    if (!month || !Number.isInteger(day) || !Number.isInteger(year)) return null;
    if (day < 1 || day > 31) return null;
    return { year: year, month: month, day: day };
}

function _requestDateFromExpiryLabel(label) {
    var ymd = _parseExpiryLabelToYmd(label);
    return ymd ? ymd.month + '/' + ymd.day + '/' + ymd.year : null;
}
`;

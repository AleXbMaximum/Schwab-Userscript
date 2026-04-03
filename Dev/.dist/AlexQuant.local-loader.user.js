// ==UserScript==
// @name         AlexHedgeFund (Local Loader)
// @namespace    https://example.com/
// @version      1.5.2
// @description  AlexHedgeFund
// @grant        GM.xmlHttpRequest
// @match        https://client.schwab.com/app/accounts/positions/*
// @grant        unsafeWindow
// @connect      query1.finance.yahoo.com
// @connect      query2.finance.yahoo.com
// @connect      finance.yahoo.com
// @connect      www.alphavantage.co
// @connect      www.barrons.com
// @connect      www.financialjuice.com
// @license      CC BY-NC-ND 4.0
// @connect      127.0.0.1
// ==/UserScript==


(async () => {
    'use strict';

    const DEV_URL = 'http://127.0.0.1:5500/.dist/AlexQuant.user.js';
    const requestUrl = DEV_URL + '?t=' + Date.now();

    function fetchText(url) {
        return new Promise((resolve, reject) => {
            GM.xmlHttpRequest({
                method: 'GET',
                url,
                headers: { 'Cache-Control': 'no-cache, no-store, max-age=0', Pragma: 'no-cache' },
                onload: (res) => {
                    if (res.status >= 200 && res.status < 300) resolve(res.responseText);
                    else reject(new Error('HTTP ' + res.status + ' loading ' + url));
                },
                onerror: () => reject(new Error('Network error loading ' + url)),
                ontimeout: () => reject(new Error('Timeout loading ' + url)),
            });
        });
    }

    try {
        const code = await fetchText(requestUrl);
        const wrapped = code + '\n//# sourceURL=' + requestUrl;
        const run = new Function('GM', 'unsafeWindow', wrapped);
        run(
            typeof GM !== 'undefined' ? GM : undefined,
            typeof unsafeWindow !== 'undefined' ? unsafeWindow : undefined,
        );
    } catch (err) {
        console.error('[AlexHedgeFund] Dev loader failed:', err);
    }
})();

// ==UserScript==
// @name         LTTStore.com USD -> CAD
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Converts prices on lttstore.com to CAD
// @author       YUKI2eN3e
// @license      CC BY
// @match        https://lttstore.com/
// @match        https://lttstore.com/*
// @match        https://www.lttstore.com/
// @match        https://www.lttstore.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM.xmlHttpRequest
// @run-at       document-end
// ==/UserScript==

(async function() {
    'use strict';
    // The interval between checking if prices on the page has changed
    // this only matters if you are doing everything on the same tab.
    // Obviously a lower value means a more frequent price update, but
    // may cause some lower-end PCs to lag.
    const priceChangeCheckInterval = 10000;



    const MONEY_REGEX = /(?!Regular price\n)(\$[\.0-9]*)(?!USD)/gm;
    const USD_CAD_RATE = 1.3533;

    // 1 USD = this much CAD
    //
    // By default it queries a currency conversion API and
    // caches the value for 5 minutes.
    const USDtoCADExchange = await getExchangeRate();

    async function getExchangeRate() {
        let stored_dollar_exchange_rate = GM_getValue('dollar_exchange_rate', null);

        if (stored_dollar_exchange_rate != null) {
            if (stored_dollar_exchange_rate.includes(':')) {
                let split_exchange_rate = stored_dollar_exchange_rate.split('\:');

                if (new Date().getTime() - parseFloat(split_exchange_rate[1]) < 1000 * 60 * 5) {
                    console.log('Using cached exchange value. ');

                    return parseFloat(split_exchange_rate[0]);
                }
            }
        }

        let valetResponse = await GM.xmlHttpRequest({
            method: 'GET',
            url:    'https://www.bankofcanada.ca/valet/observations/FXUSDCAD/json?recent=1'
        });

        if (!valetResponse || !valetResponse.responseText) {
            console.log(`Failed to fetch exchange rate. Using ${USD_CAD_RATE}}`);
            debugger;
            return USD_CAD_RATE;
        }

        let value = JSON.parse(valetResponse.responseText);

        if (!value || !value.observations[0].FXUSDCAD.v) {
            console.log(`Failed to fetch exchange rate. Using ${USD_CAD_RATE}}`);
            debugger;
            return USD_CAD_RATE;
        }

        let CADRate = value.observations[0].FXUSDCAD.v;

        GM_setValue('dollar_exchange_rate', CADRate + ":" + new Date().getTime());

        console.log('Retrieved a new exchange rate.');

        return CADRate;
    }

    function convertAll() {

        // On the main page
        convert(document.getElementsByClassName('price'));
        convert(document.getElementsByClassName('money'));

        async function getPrice(innerText) {
            let m;
            return MONEY_REGEX.exec(innerText);
        }

        async function convert(arrayIn) {
            for (let i = 0; i < arrayIn.length; i++) {
                let e = arrayIn[i];

                if (e.innerText === e.prevInnerText) continue;

                if (e.innerText.toLowerCase().includes("free")) continue;

                let price = parseFloat(String(await (getPrice(e.innerText))).substring(1));
                let converted = (USDtoCADExchange * price).toFixed(2);

                // Something went wrong
                if (price == NaN || converted == NaN) continue;

                e.innerText = e.innerText.replace(`${price} USD`, `${price} USD / $${converted} CAD`)

                e.prevInnerText = e.innerText;
            }
        }
    }

    window.addEventListener('load', function() {
        convertAll();

        setInterval(function() { convertAll(); }, priceChangeCheckInterval);
    }, false);
})();
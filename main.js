// Import Apify SDK. For more information, see https://sdk.apify.com/
const Apify = require('apify');

Apify.main(async () => {

    const input = await Apify.getInput();
    const url = input.url + input.keyword;

    const requestQueue = await Apify.openRequestQueue();
    await requestQueue.addRequest({ url });
    // await requestQueue.addRequest({ url:'https://www.amazon.com/gp/offer-listing/B08N387GNG' });

    const proxyConfiguration = await Apify.createProxyConfiguration();

    const saveData = async (request, page) => {
        const pinnedOffer = await page.evaluate(() => ({
            price: document.querySelector('#aod-pinned-offer .a-offscreen').innerText,
            shipping: document.querySelector('#aod-pinned-offer #pinned-de-id div.a-row span.a-size-base span.a-color-secondary').innerText,
            soldBy: document.querySelector('#aod-offer-soldBy span.a-size-small.a-color-base').innerText,
        }));
        let resultPinned = {...request.userData.result, ...pinnedOffer};
        console.log(resultPinned, 'pushing data')
        await Apify.pushData(resultPinned);

        const offers = await page.$$('#aod-offer-list #aod-offer');
        for (const el of offers) {
            let  offerPriceElement  =  await el.$('#aod-offer-price .a-offscreen');
            let  offerPrice = await page.evaluate(el => el.innerText, offerPriceElement);
            let  offerSoldByElement  =  await el.$('#aod-offer-soldBy a.a-size-small.a-link-normal');
            let  offerSoldBy = await page.evaluate(el => el.innerText, offerSoldByElement);
            let  offerShippingPriceElement  =  await el.$('#aod-offer-price span.a-color-secondary');
            let  offerShippingPrice = await page.evaluate(el => el.innerText, offerShippingPriceElement);
            let  offerShippingPriceTest = await page.evaluate(el => el.textContent, offerShippingPriceElement);
            let offer = {
                price: offerPrice,
                shipping: offerShippingPrice,
                soldBy: offerSoldBy,
                test:offerShippingPriceTest
            }
            let resultOfferListItem = {...request.userData.result, ...offer};
            console.log(resultOfferListItem, 'pushing data')

            await Apify.pushData(resultOfferListItem);
            // let  offerShippingPriceElement  =  await el.$('#aod-offer-price span.a-color-secondary');
            // let  offerShippingPrice = await page.evaluate(el => el.innerText, offerShippingPriceElement);
            }
        // await Apify.pushData(request.userData.result);

    }

    const handlePageFunction= async ({ request, page }) => {
        //Checking first request
        if (!request.userData.label) {
            //Getting array of "asin"(string)
            const asinsArr = await page.$$eval("div.s-asin", el => el.map(x => x.getAttribute("data-asin")));
            //Loop through array and adding requests to queque
            for (const asin of asinsArr) {
                //Check if there is an asin
                if (asin.length > 0) {
                    await requestQueue.addRequest({
                        url: input.singleItem + asin,
                        userData: {
                            label: 'item-page',
                            asin
                        }
                    });
                }
            }
        }
        else if (request.userData.label === 'item-page') {
            await page.waitForSelector("head > meta[name='description']");
            //Crawling data from page
            const result = {
                url: request.url,
                keyword: input.keyword,
                title: await page.title(),
                description:  await page.$eval("head > meta[name='description']", element => element.content),

            }
            // Adding requests to queque
            await requestQueue.addRequest({
                url: input.offersUrl + request.userData.asin,
                userData: {
                    label: 'offers-page',
                    asin: request.userData.asin,
                    result,
                }
            });
        }
        else if (request.userData.label === "offers-page") {
            // need to implement logic for getting all offers(seller, price etc.)
            await saveData(request, page);
        }
    };
    const handlePageFunction2 = async ({ request, page }) => {
        // await page.waitForNavigation({ timeout: 600000 });
        await page.waitForSelector('#aod-pinned-offer');
        await page.waitForSelector('#aod-offer-list');
        //
        // const pinnedOffer = await page.$('#aod-pinned-offer');
        // // const pinnedOffer = await page.$('#aod-offer-soldBy');
        // if (pinnedOffer) {
        //     var price = await pinnedOffer.$eval('.a-offscreen', element => element.textContent);
        //
        // }



        // await this.page.evaluate((sel) => {
        //     let elements = Array.from(document.querySelectorAll(sel));
        //     let links = elements.map(element => {
        //         return element.href
        //     })
        //     return links;
        // }, sel);

    };
    const crawler = new Apify.PuppeteerCrawler({
        // maxConcurrency: 2, // only for dev
        // navigationTimeoutSecs: 800,
        requestQueue,
        proxyConfiguration,
        handlePageFunction
    });

    console.log('Running Puppeteer script...');
    await crawler.run();
    console.log('Puppeteer closed.');
});

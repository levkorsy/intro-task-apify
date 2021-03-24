// Import Apify SDK. For more information, see https://sdk.apify.com/
const Apify = require('apify');

Apify.main(async () => {

        const input = await Apify.getInput();
        const url = input.url + input.keyword;

        const requestQueue = await Apify.openRequestQueue();
        await requestQueue.addRequest({url});
        const proxyConfiguration = await Apify.createProxyConfiguration();

        // Function saves items in dataset. Gets request object and page object
        const saveData = async (request, page) => {
            //Getting data of pinned offer
            const pinnedOffer = await page.evaluate(() => ({
                price: document.querySelector('#aod-pinned-offer .a-offscreen').innerText,
                shippingPrice: document.querySelector('#aod-pinned-offer #pinned-de-id div.a-row span.a-size-base span.a-color-secondary').innerText,
                sellerName: document.querySelector('#aod-offer-soldBy span.a-size-small.a-color-base').innerText,
            }));
            // Merging previous result object and current
            let resultPinned = {...request.userData.result, ...pinnedOffer};
            // Merging previous result object and current
            await Apify.pushData(resultPinned);

            // Getting all offers from offers list
            const offers = await page.$$('#aod-offer-list #aod-offer');

            // Loop through offers. Getting relevant data for every offer
            for (const el of offers) {
                let offerPriceElement = await el.$('#aod-offer-price .a-offscreen');
                let offerPrice = await page.evaluate(el => el.innerText, offerPriceElement);

                let offerSoldByElement = await el.$('#aod-offer-soldBy a.a-size-small.a-link-normal');
                let offerSoldBy = await page.evaluate(el => el.innerText, offerSoldByElement);

                let offerShippingPriceElement = await el.$('#aod-offer-price span.a-color-secondary');
                let offerShippingPrice = await page.evaluate(el => el.innerText, offerShippingPriceElement);

                let offer = {
                    price: offerPrice,
                    shippingPrice: offerShippingPrice,
                    sellerName: offerSoldBy,
                }
                // Merging previous result object and current
                let resultOfferListItem = {...request.userData.result, ...offer};
                // Merging previous result object and current
                await Apify.pushData(resultOfferListItem);
            }
        }

        const handlePageFunction = async ({request, page}) => {
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
            } else if (request.userData.label === 'item-page') {
                await page.waitForSelector("head > meta[name='description']");
                //Crawling data from page
                const result = {
                    url: request.url,
                    keyword: input.keyword,
                    title: await page.title(),
                    description: await page.$eval("head > meta[name='description']", element => element.content),

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
            } else if (request.userData.label === "offers-page") {
                // Function for saving offers
                await saveData(request, page);
            }
        };

        const crawler = new Apify.PuppeteerCrawler({
            requestQueue,
            proxyConfiguration,
            handlePageFunction
        });

        console.log('Running Puppeteer script...');
        await crawler.run();
        console.log('Puppeteer closed.');
    }
);

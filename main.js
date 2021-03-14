// Import Apify SDK. For more information, see https://sdk.apify.com/
const Apify = require('apify');

Apify.main(async () => {

    const input = await Apify.getInput();
    const url = input.url + input.keyword;

    const requestQueue = await Apify.openRequestQueue();
    await requestQueue.addRequest({ url });
    const proxyConfiguration = await Apify.createProxyConfiguration();


    const handlePageFunction = async ({ request, page }) => {
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
                            label: "item-page",
                            asin
                        }
                    });
                }
            }
        }
        else if (request.userData.label === "item-page") {
            await page.waitForSelector("head > meta[name='description']");
            //Crawling data from page
            const result = {
                url: request.url,
                keyword: input.keyword,
                title: await page.title(),
                description:  await page.$eval("head > meta[name='description']", element => element.content),

            }
            //Adding requests to queque
            await requestQueue.addRequest({
                url: input.offersUrl + request.userData.asin, userData: {
                    label: "offers-page",
                    asin: request.userData.asin,
                    result
                }
            });
        }
        else if (request.userData.label === "offers-page") {
            // need to implement logic for getting all offers(seller, price etc.)
            await Apify.pushData(request.userData.result);
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
});

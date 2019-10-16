const puppeteer = require('puppeteer');
const config = require('./config.js');

(async () => {
    const suite = config.load('./config.yaml');
    console.log(suite);
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/chromium-browser',
        args: ['--disable-dev-shm-usage', '--no-sandbox'],
    });
    const page = await browser.newPage();
    await page.goto('https://news.ycombinator.com', {
        waitUntil: 'networkidle2',
    });
    await page.pdf({ path: 'hn.pdf', format: 'A4' });

    await browser.close();
})();

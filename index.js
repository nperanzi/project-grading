console.log('woot');

const puppeteer = require('puppeteer');

console.log('puppeteer');
const nunjucks = require('nunjucks');

console.log('nunjucks');
const argv = require('minimist')(process.argv.slice(2));

console.log('minimist');
// const { produce } = require('immer');
const validator = require('validator');

console.log('validator');
const htmlValidator = require('html-validator');

console.log('validator');
const config = require('./config.js');

console.log('config');

console.log('woot');

// Static Width (Plain Regex)
const wrap = (s, w) => s
    .replace(/(?![^\n]{1,70}$)([^\n]{1,70})\s/g, '$1\n')
    .replace(/^/g, '     ')
    .replace('\n', '\n     ');

function showOutput(testSuite, course, nickname, url) {
    let output = '';
    testSuite.scenarios.forEach((scenario) => {
        const when = nunjucks.renderString(scenario.when, {
            testSuite,
            url,
            course,
            nickname,
        });
        output += `When ${when}\n`;
        scenario.tests.forEach((test) => {
            const contextData = Object.assign(test.context, {
                testSuite,
                test,
                url,
                course,
                nickname,
            });
            const status = test.passed ? '✅' : '❌';
            const it = nunjucks.renderString(test.it, contextData);
            const testDesc = wrap(nunjucks.renderString(test.desc, contextData));
            output += `${status} - it ${it}\n${testDesc}\n`;
        });
    });
    return output;
}

function cloneObject(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function recordTestStatus(status, testSuite, whenSlug, itSlug, context) {
    const testSuiteCopy = cloneObject(testSuite);
    testSuiteCopy.scenarios = testSuiteCopy.scenarios.map((scenario) => {
        const newScenario = cloneObject(scenario);
        const tests = scenario.tests.map((t) => {
            const test = cloneObject(t);
            if (scenario.slug === whenSlug && test.slug === itSlug) {
                test.passed = status;
                test.context = Object.assign(context || {}, test.context);
            }
            return test;
        });
        newScenario.tests = tests;
        return newScenario;
    });
    return testSuiteCopy;
}

function usage(msg) {
    console.warn(`${msg}\n`);
    console.log('index.js COURSE TEAM_NICKNAME URL');
}

const urlOptions = {
    protocols: ['http', 'https'],
    require_tld: true,
    require_protocol: true,
    require_host: true,
    require_valid_protocol: true,
    allow_underscores: false,
    host_whitelist: false,
    host_blacklist: false,
    allow_trailing_dot: false,
    allow_protocol_relative_urls: false,
    disallow_auth: false,
};

async function validatePageMarkup(url) {
    const result = await htmlValidator({ url });
    if ('messages' in result) {
        return result.messages.every((a) => a.type !== 'error');
    }
    return false;
}

(async () => {
    if (argv._.length !== 3) {
        return usage('Invalid number of inputs!');
    }
    if (/(656|660)/.test(argv._[0]) === false) {
        return usage(`Invalid class ${argv._[0]}. Must be 656 or 660.`);
    }
    if (/[a-z]-[a-z]/.test(argv._[1]) === false) {
        return usage(`Invalid team nickname ${argv._[1]}`);
    }
    if (validator.isURL(argv._[2], urlOptions) === false) {
        return usage(`Invalid URL ${argv._[1]}`);
    }
    const [course, nickname, url] = argv._;

    // Load test descriptions
    let testSuite = config.load('./config.yaml');

    // Start browser
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/chromium-browser',
        args: [
            '--disable-dev-shm-usage',
            '--no-sandbox',
            "--proxy-server='direct://'",
            '--proxy-bypass-list=*',
        ],
    });

    const finish = async () => {
        console.log(showOutput(testSuite, course, nickname, url));
        await browser.close();
        return true;
    };
    const page = await browser.newPage();

    // --------------------- Homepage tests

    // ---- up
    try {
        await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: 15000,
        });
    } catch (e) {
        return finish();
    }
    testSuite = recordTestStatus(true, testSuite, 'homepage', 'up');

    // ---- title
    const homePageTitle = await page.title();
    if (typeof homePageTitle === 'string' || homePageTitle.length > 0) {
        testSuite = recordTestStatus(true, testSuite, 'homepage', 'title', {
            title: homePageTitle,
        });
    }

    // ---- valid
    let markupValidates;
    try {
        markupValidates = await validatePageMarkup(url);
    } catch (e) {
        markupValidates = false;
    }
    testSuite = recordTestStatus(markupValidates, testSuite, 'homepage', 'valid');

    // --------------------- About tests
    try {
        await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: 5000,
        });
    } catch (e) {
        console.log(e);
        return finish();
    }
    testSuite = recordTestStatus(true, testSuite, 'about', 'exists');

    // --------------------- DONE
    finish();
    return true;
})();
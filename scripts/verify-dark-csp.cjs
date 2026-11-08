// Uses a separate headless Chrome profile and a local strict-CSP fixture, never the user's profile.
const {chromium} = require('playwright');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const http = require('node:http'), assert = require('node:assert/strict');
(async () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'be-dark-csp-'));
    const extension = path.join(folder, 'extension');
    fs.cpSync('.output/chrome-mv3', extension, {recursive: true});
    const manifestPath = path.join(extension, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.host_permissions.push('http://localhost/*'); // Test fixture access only.
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    const server = http.createServer((req, res) => {
        res.writeHead(200, {'Content-Type':'text/html',
            'Content-Security-Policy':"script-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'"});
        res.end(`<!doctype html><html><head><style>body{background:#fff;color:#111}#cssom{background:#fff;color:#222;padding:20px}</style></head><body><h1>Strict CSP dark mode</h1><p id="cssom">Dynamic stylesheet tracking</p>${req.url === '/frame' ? '' : '<iframe src="/frame"></iframe>'}</body></html>`);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const context = await chromium.launchPersistentContext(path.join(folder, 'profile'), {
        executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
        ignoreDefaultArgs: ['--disable-extensions'], args: ['--enable-unsafe-extension-debugging'],
        viewport: {width: 1000, height: 700}
    });
    try {
        const cdp = await context.browser().newBrowserCDPSession();
        await cdp.send('Extensions.loadUnpacked', {path: extension});
        const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
        await worker.evaluate(() => chrome.storage.local.set({'core.update:autoCheck':false}));
        const page = await context.newPage(), scriptErrors = [];
        page.on('pageerror', error => scriptErrors.push(error.message));
        await page.addInitScript(() => {
            window.__scriptViolations = [];
            document.addEventListener('securitypolicyviolation', event => {
                if (event.violatedDirective.startsWith('script-src')) window.__scriptViolations.push(event.blockedURI);
            });
        });
        const url = `http://localhost:${server.address().port}/`;
        await page.goto(url);
        await page.evaluate(() => {window.__originalInsertRule = CSSStyleSheet.prototype.insertRule;});
        await worker.evaluate(() => chrome.storage.local.set({'core.darkMode':{
            enabledByDefault:false, enabledSites:['localhost'], followSystem:false
        }}));
        await page.waitForFunction(() => document.querySelector('.darkreader--sync') &&
            CSSStyleSheet.prototype.insertRule !== window.__originalInsertRule);
        const before = await page.locator('#cssom').evaluate(el => getComputedStyle(el).backgroundColor);
        assert.notEqual(before, 'rgb(255, 255, 255)');
        await page.evaluate(() => {
            const style = [...document.querySelectorAll('style')].find(el => !el.classList.contains('darkreader'));
            style.sheet.insertRule('#cssom{background:rgb(230,220,200);color:rgb(40,20,10)}', style.sheet.cssRules.length);
        });
        await page.waitForFunction(before => {
            const color = getComputedStyle(document.querySelector('#cssom')).backgroundColor;
            return color !== before && Number(color.match(/\d+/)[0]) < 130;
        }, before);
        await page.screenshot({path:path.join(folder,'strict-csp-dark.png')});
        // A fresh document exercises registered MAIN/ISOLATED ordering and iframe registration.
        await page.reload();
        await page.waitForFunction(() => document.querySelector('.darkreader--sync') && document.documentElement.hasAttribute('data-bong-dark-proxy'));
        const frame = page.frames().find(item => item !== page.mainFrame());
        await frame.waitForFunction(() => document.querySelector('.darkreader--sync'));
        await page.emulateMedia({colorScheme:'dark'});
        await worker.evaluate(async () => {
            const stored = await chrome.storage.local.get('core.darkMode');
            await chrome.storage.local.set({'core.darkMode':{...stored['core.darkMode'], followSystem:true}});
        });
        await page.waitForFunction(() => document.documentElement.hasAttribute('data-bong-dark-proxy'));
        await page.emulateMedia({colorScheme:'light'});
        await page.waitForFunction(() => !document.querySelector('.darkreader--sync') && !document.documentElement.hasAttribute('data-bong-dark-proxy'));
        await page.emulateMedia({colorScheme:'dark'});
        await page.waitForFunction(() => document.querySelector('.darkreader--sync') && document.documentElement.hasAttribute('data-bong-dark-proxy'));
        for (const item of page.frames()) assert.deepEqual(await item.evaluate(() => window.__scriptViolations), []);
        assert.deepEqual(scriptErrors, []);
        console.log('PASS strict CSP: no inline script violations; live CSSOM, existing tabs, reload, iframe and system-theme lifecycle;', folder);
    } finally {await context.close(); await new Promise(resolve => server.close(resolve));}
})().catch(error => {console.error(error);process.exitCode=1;});

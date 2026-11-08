// Keep the packaged MAIN-world proxy identical to the pinned upstream implementation.
const fs = require('node:fs');
const source = fs.readFileSync('node_modules/darkreader/darkreader.mjs', 'utf8').replace(/\r\n/g, '\n');
// Upstream's formatter leaves only top-level closing braces unindented.
const proxy = source.match(/^function injectProxy\([^]*?^}/m)?.[0];
if (!proxy) throw new Error('Dark Reader injectProxy was not found');
const license = fs.readFileSync('node_modules/darkreader/LICENSE', 'utf8');
const output = `/* Dark Reader 4.9.134 — upstream injectProxy, unchanged.\n * https://github.com/darkreader/darkreader\n * ${license.trim().replace(/\r\n/g, '\n').replace(/\n/g, '\n * ')}\n */\nexport ${proxy}\n`;
const target = 'src/modules/dark/proxy.js';
if (process.argv.includes('--check')) {
    if (fs.readFileSync(target, 'utf8') !== output) throw new Error('Run node scripts/sync-darkreader-proxy.cjs');
} else fs.writeFileSync(target, output);

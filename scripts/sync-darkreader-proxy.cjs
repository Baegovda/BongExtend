// Keep the packaged proxy pinned upstream, with one explicit lifecycle adapter:
// return its existing cleanup closure so document.open cannot orphan native hooks.
const fs = require('node:fs');
const source = fs.readFileSync('node_modules/darkreader/darkreader.mjs', 'utf8').replace(/\r\n/g, '\n');
// Upstream's formatter leaves only top-level closing braces unindented.
const proxy = source.match(/^function injectProxy\([^]*?^}/m)?.[0];
if (!proxy) throw new Error('Dark Reader injectProxy was not found');
const license = fs.readFileSync('node_modules/darkreader/LICENSE', 'utf8');
const adapted = proxy.replace(/\n}$/, '\n    return cleanUp; // BongExtend: survive document.open removing document listeners.\n}');
const output = `/* Dark Reader 4.9.134 — upstream injectProxy + cleanup return adapter.\n * https://github.com/darkreader/darkreader\n * ${license.trim().replace(/\r\n/g, '\n').replace(/\n/g, '\n * ')}\n */\nexport ${adapted}\n`;
const target = 'src/modules/dark/proxy.js';
if (process.argv.includes('--check')) {
    if (fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n') !== output) throw new Error('Run node scripts/sync-darkreader-proxy.cjs');
} else fs.writeFileSync(target, output);

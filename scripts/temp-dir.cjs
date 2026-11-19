// Disposable %TEMP% folders for the browser check scripts (extension copy, Chrome profile, downloads, screenshots).
// A run that ends with exit code 0 removes its folders when the process exits, after the script has closed Chrome.
// A failed run, `--keep`, or BE_KEEP_TEMP=1 leaves them as evidence and prints where they are.
// Left-over folders made thousands of files a day and kept Windows Defender busy scanning them.
'use strict';
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');

const keepTemp = process.argv.includes('--keep') || /^(1|true|yes)$/i.test(process.env.BE_KEEP_TEMP || '');
const folders = [];

/**
 * Create a fresh folder under the system temp directory.
 * @param {string} prefix e.g. 'be-ui-flow-'
 * @param {{keep?: boolean}} [options] keep: always leave it (for preview scripts whose output is the point)
 */
function makeTempDir(prefix, options = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  folders.push({ dir, keep: !!options.keep });
  return dir;
}

process.on('exit', code => {
  for (const { dir, keep } of folders) {
    if (keep || keepTemp || code !== 0) {
      if (fs.existsSync(dir)) console.log('Evidence:', dir);
      continue;
    }
    try {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    } catch (error) {
      console.warn(`Could not remove temp folder ${dir}: ${error.message}`);
    }
  }
});

module.exports = { makeTempDir, keepTemp };

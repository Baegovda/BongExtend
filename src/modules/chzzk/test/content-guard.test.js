import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const content = readFileSync(new URL('../content.js', import.meta.url), 'utf8');
const extras = readFileSync(new URL('../content-extras.js', import.meta.url), 'utf8');

test('buffering recovery runs only in the top frame', () => {
  assert.match(content, /if \(window\.top !== window\) return;/);
});

test('recovery and ad skip stay on a live watch page', () => {
  assert.match(content, /canRecover\(\)/);
  assert.match(content, /stopRecovery\(\)/);
  assert.match(content, /if \(!cfg\.enabled \|\| !canRecover\(\)\)/);
  assert.match(extras, /function adScope\(\)/);
  assert.match(extras, /if \(!adScope\(\)\)/);
  assert.match(readFileSync(new URL('../lib/retrytimer.js', import.meta.url), 'utf8'), /function shouldRecover/);
});

test('ad boost is marked so the 1x reset does not cancel it', () => {
  assert.match(extras, /_bongAdBoost = 1/);
  assert.match(content, /!v\._bongAdBoost/);
  assert.match(extras, /__bongRetryAudioRestore/);
});

test('live conceal uses the planner and does not boost the broadcast video', () => {
  assert.match(extras, /resolveAdConceal/);
  assert.match(extras, /isBoostTarget/);
  assert.match(extras, /AD_CONCEAL_SHADOW_CSS/);
  assert.match(readFileSync(new URL('../content-adflag.js', import.meta.url), 'utf8'), /AD_CONCEAL_SHADOW_CSS/);
});

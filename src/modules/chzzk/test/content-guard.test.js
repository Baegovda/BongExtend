import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const content = readFileSync(new URL('../content.js', import.meta.url), 'utf8');
const extras = readFileSync(new URL('../content-extras.js', import.meta.url), 'utf8');

test('buffering recovery runs only in the top frame', () => {
  assert.match(content, /if \(window\.top !== window\) return;/);
});

test('ad boost is marked so the 1x reset does not cancel it', () => {
  assert.match(extras, /_bongAdBoost = 1/);
  assert.match(content, /!v\._bongAdBoost/);
  assert.match(extras, /__bongRetryAudioRestore/);
});

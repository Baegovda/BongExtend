import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = {}; ctx.globalThis = ctx;
vm.runInNewContext(readFileSync(new URL('../lib/player.js', import.meta.url), 'utf8'), ctx);
const P = ctx.BongPlayer;

test('isSkipButtonLabel', () => {
  for (const t of ['SKIP', 'SKIP ▶|', ' skip ⏭ ', 'SKIP▶', '건너뛰기', '광고 건너뛰기']) assert.equal(P.isSkipButtonLabel(t), true, t);
  for (const t of ['1초 후 SKIP', '5 초 후 SKIP', '광고 페이지 보기', 'SKIPPED ads', '', null]) assert.equal(P.isSkipButtonLabel(t), false, String(t));
});
test('isSkipCandidate excludes countdown and ad link', () => {
  assert.equal(P.isSkipCandidate({ text: 'SKIP ▶|' }), true);
  assert.equal(P.isSkipCandidate({ text: '9초 후 SKIP', inCountdown: true }), false);
  assert.equal(P.isSkipCandidate({ text: 'SKIP', inCountdown: true, disabled: true }), false);
  assert.equal(P.isSkipCandidate({ text: 'SKIP', inLink: true }), false);
  assert.equal(P.isSkipCandidate({ text: 'SKIP', dataRole: 'adLink' }), false);
  assert.equal(P.isSkipCandidate({ text: '9초 후 SKIP', dataRole: 'countDownTxt' }), false);
  assert.equal(P.isSkipCandidate({ text: 'SKIP', dataRole: 'skipBtn' }), true);
});
test('skip waits out the countdown and clicks once the button is enabled', () => {
  const ad = { id: 'page', text: '광고 페이지 보기', disabled: false };
  const counting = { id: 'count', text: '9초 후 SKIP', disabled: true, className: 'btn_skip' };
  const locked = { id: 'skip', text: 'SKIP', disabled: true, ariaDisabled: 'true' };
  assert.equal(P.countdownSeconds('9초 후 SKIP'), 9);
  assert.equal(P.countdownSeconds('0초 뒤 건너뛰기'), 0);
  assert.equal(P.countdownSeconds('SKIP'), null);
  assert.equal(P.skipAction(ad), 'ignore');
  assert.equal(P.skipAction(counting), 'wait');
  assert.equal(P.skipAction({ text: '9초 후 SKIP', disabled: false }), 'wait');
  assert.equal(P.skipAction(locked), 'wait');
  assert.equal(P.skipAction({ text: 'SKIP', className: 'btn_skip is-disabled' }), 'wait');
  assert.equal(P.pickSkipElement([ad, counting, locked]), null);
  locked.disabled = false;
  locked.ariaDisabled = 'false';
  assert.equal(P.pickSkipElement([ad, counting, locked]).id, 'skip');
  assert.equal(P.pickSkipElement([{ id: 'zero', text: '0초 후 SKIP', ariaLabel: 'SKIP', disabled: false }]).id, 'zero');
  assert.equal(P.skipAction({ ariaLabel: '9초 후 SKIP', text: 'SKIP', disabled: false }), 'wait');
  assert.equal(P.skipAction({ ariaLabel: 'SKIP', text: 'SKIP', disabled: false }), 'ready');
});
test('hasAdContainer', () => {
  assert.equal(P.hasAdContainer({ querySelector: s => (s === '[data-role="adVideoContainerEl"]' ? { isConnected: true } : null) }), true);
  assert.equal(P.hasAdContainer({ querySelector: () => ({ isConnected: false }) }), false);
  assert.equal(P.hasAdContainer({ querySelector: () => null }), false);
  assert.equal(P.hasAdContainer(null), false);
});
test('seekEndTime', () => {
  assert.equal(P.seekEndTime(15), 14.95);
  assert.equal(P.seekEndTime(0.01), 0);
  assert.equal(P.seekEndTime(Infinity), null);
  assert.equal(P.seekEndTime(NaN), null);
  assert.equal(P.seekEndTime(0), null);
});

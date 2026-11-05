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

test('재생 중 사이트가 건 음소거는 풀고 사용자의 음량 설정은 저장한다', () => {
  assert.match(extras, /audioPreference/);
  assert.match(extras, /audioStateMatches/);
  assert.match(extras, /addEventListener\('playing'/);
  assert.match(extras, /audioPointerActive/);
});

test('넓은 화면 버튼은 치지직 PZP 선택자와 실제 레이아웃 상태로 재시도한다', () => {
  const wide = readFileSync(new URL('../content-wide.js', import.meta.url), 'utf8');
  assert.match(wide, /\.pzp-viewmode-button/);
  assert.match(wide, /MAX_CLICKS/);
  assert.match(readFileSync(new URL('../lib/wide.js', import.meta.url), 'utf8'), /layoutKnown/);
});

test('live conceal uses the planner and does not boost the broadcast video', () => {
  assert.match(extras, /planBlackRecovery/);
  assert.match(extras, /isBoostTarget/);
  assert.match(extras, /preAdContentPlayer/);
  assert.match(extras, /AD_CONCEAL_SHADOW_CSS/);
  assert.doesNotMatch(extras, /opacity', '0'/);
  assert.match(readFileSync(new URL('../content-adflag.js', import.meta.url), 'utf8'), /AD_CONCEAL_SHADOW_CSS/);
});

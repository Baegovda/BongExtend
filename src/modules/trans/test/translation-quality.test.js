import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTranslator } from '../lib/translator.js';
import { makeCacheKey } from '../lib/cache.js';

const source = 'Forwarded from sample@example.invalid by Firefox Relay Premium Email trackers removed Manage this mask 배송 현황';
const target = 'sample@example.invalid에서 Firefox Relay Premium으로 전달됨 이메일 추적기 제거됨 이 마스크 관리 배송 현황';
function fixture(fn, settings = {}) {
  const data = new Map(); let calls = 0; let clock = 0;
  const translator = createTranslator({
    persistentCache: { get: async key => data.get(key), setMany: async pairs => pairs.forEach(([k,v]) => data.set(k,v)) },
    loadSettings: async () => settings, now: () => clock,
    translateFn: async texts => { calls++; return fn(texts); },
  });
  return { translator, data, calls: () => calls, advance: () => { clock += 30001; } };
}
test('suspect stored Relay preview is selectively repaired once and concurrent requests share it', async () => {
  const f = fixture(texts => texts.map(() => target));
  const key = await makeCacheKey('gemini-3.5-flash-lite', 'ko', source);
  f.data.set(key,source);
  const results = await Promise.all([f.translator.translateMany([source,source]),f.translator.translateMany([source])]);
  assert.equal(results[0].translations[0],target); assert.equal(results[1].translations[0],target);
  assert.equal(f.calls(),1); assert.equal(f.data.get(key),target);
  await f.translator.translateMany([source]); assert.equal(f.calls(),1);
});
test('fresh unchanged/partial Relay result fails without caching and repeated failure cools down', async () => {
  for (const result of [source, '전달됨 Firefox Relay Premium Email trackers removed 마스크 관리']) {
    const f = fixture(texts => texts.map(() => result));
    for (let i=0;i<2;i++) await assert.rejects(f.translator.translateMany([source]), {code:'INCOMPLETE_TRANSLATION'});
    assert.equal(f.calls(),1); assert.equal(f.data.size,0);
    f.advance(); await assert.rejects(f.translator.translateMany([source]), {code:'INCOMPLETE_TRANSLATION'});
    assert.equal(f.calls(),2);
  }
});
test('failed cache repair preserves old data and never loops', async () => {
  const f = fixture(texts => texts); const key = await makeCacheKey('gemini-3.5-flash-lite','ko',source);
  f.data.set(key,source);
  await assert.rejects(f.translator.translateMany([source]), {code:'INCOMPLETE_TRANSLATION'});
  assert.equal(f.data.get(key),source); assert.equal(f.calls(),1);
});
test('addresses, brands, SKUs, names and Korean keep normal cache behavior', async () => {
  const texts = ['sample@example.invalid','https://example.invalid','Firefox Relay Premium','SKU-123','Alice','배송 현황'];
  const f = fixture(texts => texts);
  assert.deepEqual((await f.translator.translateMany(texts)).translations,texts);
  await f.translator.translateMany(texts); assert.equal(f.calls(),1);
});
test('other target languages and unrelated prose are not guessed by a Korean Relay rule', async () => {
  const f = fixture(texts => texts,{targetLanguage:'en'});
  assert.deepEqual((await f.translator.translateMany([source])).translations,[source]);
});

test('Korean explanations quoting Relay button names keep valid cached translations', async () => {
  const texts = ['Firefox Relay에서 "Manage this mask"라는 버튼 이름을 확인했어요.',
    '다음은 Firefox Relay의 예시예요: Forwarded from sample@example.invalid by Firefox Relay Premium'];
  const f = fixture(texts => texts);
  assert.deepEqual((await f.translator.translateMany(texts)).translations, texts);
  await f.translator.translateMany(texts);
  assert.equal(f.calls(), 1);
});

test('concurrent incomplete calls share failure and healthy stored values stay untouched', async () => {
  const f = fixture(texts => texts);
  const healthy = 'Firefox Relay Premium';
  const key = await makeCacheKey('gemini-3.5-flash-lite','ko',healthy);
  f.data.set(key,healthy);
  const results = await Promise.allSettled([f.translator.translateMany([source]),f.translator.translateMany([source])]);
  assert.ok(results.every(item => item.status === 'rejected' && item.reason.code === 'INCOMPLETE_TRANSLATION'));
  assert.equal(f.calls(),1);
  assert.deepEqual((await f.translator.translateMany([healthy])).translations,[healthy]);
  assert.equal(f.calls(),1); assert.equal(f.data.get(key),healthy);
});

test('isolated split Relay labels are repaired or rejected without requiring a sibling brand', async () => {
  for (const label of ['Forwarded from','Email trackers removed','Manage this mask']) {
    const good = fixture(texts=>texts.map(()=>'한국어 안내'));
    const key=await makeCacheKey('gemini-3.5-flash-lite','ko',label);
    good.data.set(key,label);
    assert.deepEqual((await good.translator.translateMany([label])).translations,['한국어 안내']);
    assert.equal(good.calls(),1);
    const bad=fixture(texts=>texts);
    await assert.rejects(bad.translator.translateMany([label]),{code:'INCOMPLETE_TRANSLATION'});
    assert.equal(bad.data.size,0);
  }
});

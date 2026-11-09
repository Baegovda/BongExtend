import {test} from 'node:test';
import assert from 'node:assert/strict';
import {darkFrameHost as host} from '../frame-host.js';

test('regular frames use their own site instead of a parent site', () => {
  assert.equal(host('https://note.naver.com/list', true, ['https://www.naver.com']), 'note.naver.com');
  assert.equal(host('https://unrelated.test/', true, ['https://note.naver.com']), 'unrelated.test');
});
test('embedded opaque documents inherit the nearest available web origin', () => {
  for (const url of ['about:blank','about:srcdoc','data:text/html,test','blob:https://note.naver.com/test'])
    assert.equal(host(url, true, ['https://note.naver.com']), 'note.naver.com');
  assert.equal(host('about:srcdoc', true, [], 'https://note.naver.com/list'), 'note.naver.com');
  assert.equal(host('blob:https://note.naver.com/test', true), 'note.naver.com');
  assert.equal(host('about:blank', true, ['null','https://note.naver.com']), 'note.naver.com');
});
test('top-level blank and browser-internal pages do not inherit site settings', () => {
  assert.equal(host('about:blank', false, [], 'https://note.naver.com'), '');
  assert.equal(host('chrome://settings', true, ['https://note.naver.com']), '');
  assert.equal(host('about:srcdoc', true, ['null']), '');
  assert.equal(host('invalid', true, ['https://note.naver.com']), '');
});

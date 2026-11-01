import assert from 'node:assert/strict';
import { test } from 'node:test';
import { originPermissionPattern } from '../lib/origin-permission.js';

test('origin permission pattern is one http(s) origin', () => {
  assert.equal(originPermissionPattern('https://shop.example.com/item?id=1'), 'https://shop.example.com/*');
  assert.equal(originPermissionPattern('http://example.com'), 'http://example.com/*');
  assert.equal(originPermissionPattern('https://example.com'), 'https://example.com/*');
  assert.equal(originPermissionPattern('chrome://extensions'), '');
  assert.equal(originPermissionPattern('file:///tmp/a.html'), '');
  assert.equal(originPermissionPattern(''), '');
  assert.equal(originPermissionPattern('not a url'), '');
});

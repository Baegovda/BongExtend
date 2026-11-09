import assert from 'node:assert/strict';
import {test} from 'node:test';
import {darkStylesheetPermission as permission} from '../css-resource.js';

test('DC login can read its cross-origin DC stylesheets with existing permission', () => {
  assert.equal(permission('https://sign.dcinside.com/login', 'https://nstatic.dcinside.com/dc/w/css/login.css?v=1'), 'https://*.dcinside.com/*');
  assert.equal(permission('https://gall.dcinside.com/', 'https://ssl.dcinside.com/css/common.css'), 'https://*.dcinside.com/*');
});
test('Naver stylesheet routes keep their existing permission requirements', () => {
  assert.equal(permission('https://www.naver.com/', 'https://pm.pstatic.net/main.css'), 'https://*.pstatic.net/*');
  assert.equal(permission('https://www.naver.com/', 'https://spastatic.naver.com/main.css'), 'https://*.naver.com/*');
});
test('CSS bridge refuses unrelated origins, non-CSS, credentials and insecure resources', () => {
  for (const page of ['https://dcinside.com.evil.test/', 'https://unrelated.test/', 'http://sign.dcinside.com/'])
    assert.equal(permission(page, 'https://nstatic.dcinside.com/login.css'), null);
  for (const resource of ['https://dcinside.com.evil.test/login.css', 'https://nstatic.dcinside.com/login',
    'http://nstatic.dcinside.com/login.css', 'https://user:pass@nstatic.dcinside.com/login.css',
    'https://nstatic.dcinside.com:8443/login.css', 'https://pm.pstatic.net/main.css'])
    assert.equal(permission('https://sign.dcinside.com/login', resource), null);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {startWideFullscreenBridge, WIDE_FULLSCREEN_KEY} from '../wide-fullscreen.js';

const url = 'https://chzzk.naver.com/live/' + 'a'.repeat(32);
const flush = () => new Promise(resolve => setImmediate(resolve));
function fixture(previousState = 'normal', existing = {}) {
  const event = () => {
    const listeners = [];
    return {addListener: fn => listeners.push(fn), fire: (...args) => listeners.map(fn => fn(...args))};
  };
  const windows = new Map([[9, {id:9, state:previousState, focused:true, left:-1200, top:40, width:1100, height:760}]]);
  const tabs = new Map([[3, {id:3, active:true, windowId:9, url}]]);
  const session = structuredClone(existing), updates = [], local = {}, sync = {};
  const api = {
    runtime: {id:'self', onMessage:event(), connectNative:() => assert.fail('Native shortcuts must never be called')},
    windows: {get:async id => {if (!windows.has(id)) throw Error('No window'); return {...windows.get(id)};},
      update:async (id, value) => {updates.push({id,...value}); Object.assign(windows.get(id), value); return {...windows.get(id)};},
      onBoundsChanged:event(), onRemoved:event()},
    tabs: {get:async id => ({...tabs.get(id)}), sendMessage:async () => {}, onActivated:event(), onRemoved:event(), onUpdated:event(), onDetached:event()},
    storage: {session:{get:async () => structuredClone(session), set:async value => Object.assign(session, structuredClone(value))},
      local:{get:async () => local}, sync:{get:async () => sync}, onChanged:event()}
  };
  startWideFullscreenBridge(api);
  const sender = {id:'self', frameId:0, documentId:'document-one', url, tab:{...tabs.get(3)}};
  const send = (wide, from = sender, type = 'BONG_CHZZK_WIDE_FULLSCREEN') => new Promise(resolve => {
    // Only one message listener exists in this isolated fixture.
    const accepted = api.runtime.onMessage.fire({type, wide}, from, resolve);
    if (!accepted.includes(true)) resolve(undefined);
  });
  return {api, windows, tabs, session, updates, local, sync, sender, send};
}

test('wide entry and exit restore the normal window position and size, without duplicate toggles', async () => {
  const f = fixture();
  assert.equal((await f.send(true)).status, 'fullscreen');
  await f.send(true);
  assert.equal(f.updates.length, 1);
  await f.send(false);
  assert.deepEqual(f.updates, [{id:9, state:'fullscreen'}, {id:9, state:'normal', left:-1200, top:40, width:1100, height:760}]);
  assert.deepEqual(f.session[WIDE_FULLSCREEN_KEY], {});
});

test('maximized windows return to maximized; pre-existing fullscreen belongs to the user', async () => {
  const maximized = fixture('maximized');
  await maximized.send(true); await maximized.send(false);
  assert.deepEqual(maximized.updates.at(-1), {id:9, state:'maximized'});
  const fullscreen = fixture('fullscreen');
  assert.equal((await fullscreen.send(true)).status, 'already-fullscreen');
  await fullscreen.send(false);
  assert.deepEqual(fullscreen.updates, []);
});

test('inactive tabs, unfocused windows, disabled settings, other sites and frames cannot enter fullscreen', async () => {
  const f = fixture();
  for (const from of [{...f.sender, id:'other'}, {...f.sender, frameId:1}, {...f.sender, url:'https://example.com/live/a'}]) await f.send(true, from);
  await f.send(true, f.sender, 'BONG_COLLAPSE_VERTICAL_TABS');
  f.windows.get(9).focused = false; await f.send(true);
  f.windows.get(9).focused = true; f.tabs.get(3).active = false; await f.send(true);
  f.tabs.get(3).active = true; f.sync['chzzk.wideFullscreen'] = false; await f.send(true);
  f.sync['chzzk.wideFullscreen'] = true; f.local['core.modules'] = {chzzk:false}; await f.send(true);
  assert.deepEqual(f.updates, []);
});

test('exit from another document cannot undo a newer wide session', async () => {
  const f = fixture(); await f.send(true);
  await f.send(false, {...f.sender, documentId:'old-document'});
  assert.equal(f.windows.get(9).state, 'fullscreen');
  await f.send(false);
  assert.equal(f.windows.get(9).state, 'normal');
});

test('tab switch, navigation, tab close and detachment release the owned fullscreen', async () => {
  for (const action of [
    f => f.api.tabs.onActivated.fire({tabId:4, windowId:9}),
    f => f.api.tabs.onUpdated.fire(3, {url:'https://example.com/'}, f.tabs.get(3)),
    f => f.api.tabs.onRemoved.fire(3, {windowId:9, isWindowClosing:false}),
    f => f.api.tabs.onDetached.fire(3, {oldWindowId:9})
  ]) {
    const f = fixture(); await f.send(true); action(f); await flush();
    assert.equal(f.windows.get(9).state, 'normal');
  }
});

test('manual F11 exit is respected until wide mode itself is turned off and on', async () => {
  const f = fixture(); await f.send(true);
  f.windows.get(9).state = 'normal'; f.api.windows.onBoundsChanged.fire({...f.windows.get(9)}); await flush();
  assert.equal((await f.send(true)).status, 'manual-exit');
  assert.equal(f.updates.length, 1);
  await f.send(false); await f.send(true);
  assert.equal(f.windows.get(9).state, 'fullscreen');
});

test('an interrupted worker can restore the session; disabling the feature or module also restores it', async () => {
  const f = fixture('maximized'); await f.send(true);
  const resumed = fixture('fullscreen', f.session);
  await resumed.send(false);
  assert.equal(resumed.windows.get(9).state, 'maximized');
  for (const [changes, area] of [
    [{'chzzk.wideFullscreen':{newValue:false}}, 'sync'],
    [{'core.modules':{newValue:{chzzk:false}}}, 'local']
  ]) {
    const current = fixture(); await current.send(true);
    current.api.storage.onChanged.fire(changes, area); await flush();
    assert.equal(current.windows.get(9).state, 'normal');
  }
});

test('fast enter/exit is serialized and failed entry does not leave restoration ownership', async () => {
  const f = fixture(); await Promise.all([f.send(true), f.send(false)]);
  assert.equal(f.windows.get(9).state, 'normal');
  f.api.windows.update = async () => {throw Error('Rejected');};
  assert.equal((await f.send(true)).ok, false);
  assert.deepEqual(f.session[WIDE_FULLSCREEN_KEY], {});
});

test('invalid saved monitor bounds still exit fullscreen through Chrome restoration', async () => {
  const f = fixture(); await f.send(true);
  const update = f.api.windows.update;
  f.api.windows.update = async (id, value) => {
    if ('left' in value) throw Error('Bounds must be at least 50% within visible screen space');
    return update(id, value);
  };
  assert.equal((await f.send(false)).ok, true);
  assert.equal(f.windows.get(9).state, 'normal');
  assert.deepEqual(f.session[WIDE_FULLSCREEN_KEY], {});
});

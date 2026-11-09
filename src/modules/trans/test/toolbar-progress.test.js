import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bindToolbarProgress, createToolbarProgress } from '../toolbar-progress.js';

const active = { enabled: true, busy: true };
const idle = { enabled: true, busy: false };
const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
function harness(loadFrames = async () => ['frame-a', 'frame-b']) {
  const icons = [], titles = [], timers = new Map(); let id = 0;
  const action = { setIcon: async value => icons.push(value), setTitle: async value => titles.push(value) };
  const progress = createToolbarProgress({ action, iconPaths: { 16: 'icons/16.png' }, loadFrames,
    setTimer(fn) { timers.set(++id, fn); return id; }, clearTimer(key) { timers.delete(key); } });
  return { progress, icons, titles, timers, tick() { const entries = [...timers]; timers.clear(); for (const [, fn] of entries) fn(); } };
}

test('toolbar animates only busy tabs, aggregates frames, and stops after the final frame', async () => {
  const h = harness();
  h.progress.report(4, 0, 'top', active);
  h.progress.report(4, 2, 'chat', active);
  h.progress.report(5, 0, 'other', idle);
  await settle();
  assert.equal(h.icons.at(-1).imageData, 'frame-a');
  assert.equal(h.icons.every(icon => icon.tabId === 4), true);
  h.tick(); await settle();
  assert.equal(h.icons.at(-1).imageData, 'frame-b');
  h.progress.report(4, 0, 'top', idle);
  assert.equal(h.timers.size, 1, 'the chat frame is still translating');
  h.progress.report(4, 2, 'chat', { ...active, error: 'rate limited' });
  assert.deepEqual(h.icons.at(-1), { tabId: 4, path: { 16: 'icons/16.png' } });
  assert.equal(h.titles.at(-1).title, 'BongExtend');
  assert.equal(h.timers.size, 0);
});

test('late canvas loading cannot restore a spinner after work is finished', async () => {
  let release;
  const h = harness(() => new Promise(resolve => { release = resolve; }));
  h.progress.report(1, 0, 'top', active);
  h.progress.report(1, 0, 'top', idle);
  release(['late']); await settle();
  assert.equal(h.icons.some(icon => icon.imageData), false);
  assert.equal(h.timers.size, 0);
});

test('document replacement, original view, module disable and tab removal stop work indicators', async () => {
  const h = harness();
  h.progress.report(2, 7, 'old', active); await settle();
  h.progress.report(2, 7, 'new', active);
  h.progress.disconnect(2, 7, 'old');
  assert.equal(h.timers.size, 1);
  h.progress.disconnect(2, 7, 'new');
  assert.equal(h.timers.size, 0);
  h.progress.report(2, 0, 'top', active); await settle();
  h.progress.report(2, 0, 'top', { ...active, showOriginal: true });
  assert.equal(h.timers.size, 0);
  h.progress.report(2, 0, 'top', active); await settle();
  h.progress.setEnabled(true);
  assert.equal(h.timers.size, 1, 'unrelated module changes must not stop an ongoing translation');
  h.progress.setEnabled(false);
  assert.equal(h.timers.size, 0);
  h.progress.report(2, 0, 'top', active);
  assert.equal(h.timers.size, 0);
  h.progress.setEnabled(true);
  h.progress.report(2, 0, 'top', active); await settle();
  const count = h.icons.length;
  h.progress.clear(2, true);
  assert.equal(h.timers.size, 0);
  assert.equal(h.icons.length, count, 'never write to a closed tab');
});

test('progress ports accept only this extension and ignore obsolete navigation messages', async () => {
  const event = () => ({ listeners: [], addListener(fn) { this.listeners.push(fn); }, fire(...args) { this.listeners.forEach(fn => fn(...args)); } });
  const icons = [];
  const api = { runtime: { id: 'test', getManifest: () => ({ icons: {16:'icons/16.png'} }), getURL: p => p, onConnect: event() },
    action: { setIcon: async v => icons.push(v), setTitle: async () => {} },
    tabs: { onRemoved: event(), onUpdated: event() },
    storage: { local: { get: async () => ({}) }, onChanged: event() } };
  bindToolbarProgress(api);
  const port = (sender = 'test') => ({ name: 'bongextend-translation-progress', sender: { id: sender, tab: { id: 3 }, frameId: 1 }, onMessage: event(), onDisconnect: event() });
  const alien = port('alien'); api.runtime.onConnect.fire(alien);
  assert.equal(alien.onMessage.listeners.length, 0);
  const old = port(); api.runtime.onConnect.fire(old);
  old.onMessage.fire(active); await settle();
  api.tabs.onUpdated.fire(3, { status: 'loading' });
  const count = icons.length;
  old.onMessage.fire(active); await settle();
  assert.equal(icons.length, count);
  old.onDisconnect.fire();
});

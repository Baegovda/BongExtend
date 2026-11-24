import test from 'node:test';
import assert from 'node:assert/strict';
import {pickMedia, createMediaSniffer} from '../video-sniff.js';

test('pickMedia prefers a master playlist over files and skips ads; referer is the frame page', () => {
 const page = {page: 'https://site.example/watch?id=1', playing: false, items: [
  {url: 'https://ads.example/vast/preroll.mp4', kind: 'file', from: 'network'},
  {url: 'https://cdn.example/v/clip.mp4', kind: 'file', from: 'network'}
 ]};
 const player = {page: 'https://player.example/embed/9', playing: true, items: [
  {url: 'https://cdn.example/v/720.m3u8', kind: 'hls', from: 'network'},
  {url: 'https://cdn.example/v/master.m3u8', kind: 'hls', from: 'network'}
 ]};
 assert.deepEqual(pickMedia([page, player]), {url: 'https://cdn.example/v/master.m3u8', referer: 'https://player.example/embed/9'});
 assert.deepEqual(pickMedia([page]), {url: 'https://cdn.example/v/clip.mp4', referer: 'https://site.example/watch?id=1'});
 assert.equal(pickMedia([{page: 'https://a.example/', items: [{url: 'https://a.example/ads/x.mp4', kind: 'file', from: 'network'}]}]), null);
 assert.equal(pickMedia([null, {}]), null);
});

test('the sniffer uses the given tab, else a tab with the same address, and never returns the page itself', async () => {
 const calls = [];
 const api = {
  tabs: {get: async (id) => (id === 5 ? {id: 5, url: 'https://site.example/watch?id=1'} : Promise.reject(new Error('gone'))), query: async () => [{id: 8, url: 'https://other.example/p#top'}]},
  scripting: {executeScript: async (options) => { calls.push(options); return [{result: {page: 'https://site.example/watch?id=1', playing: true, items: [{url: 'https://cdn.example/a.m3u8', kind: 'hls', from: 'network'}]}}]; }}
 };
 const sniff = createMediaSniffer(api);
 assert.deepEqual((await sniff('https://site.example/watch?id=1', 5)).media, {url: 'https://cdn.example/a.m3u8', referer: 'https://site.example/watch?id=1'});
 assert.equal(calls[0].target.tabId, 5);
 assert.equal(calls[0].target.allFrames, true);
 assert.equal(calls[0].world, 'MAIN');
 await sniff('https://other.example/p', 99);
 assert.equal(calls[1].target.tabId, 8, 'falls back to the open tab with that address');
 assert.equal((await sniff('https://nowhere.example/', undefined)).reason, 'no-tab');
 const self = createMediaSniffer({...api, scripting: {executeScript: async () => [{result: {page: 'https://site.example/v.mp4', items: [{url: 'https://site.example/v.mp4', kind: 'file', from: 'video'}]}}]}});
 assert.equal((await self('https://site.example/v.mp4', 5)).reason, 'not-found', 'the page URL itself is not a fallback');
 const iframe = createMediaSniffer({...api, scripting: {executeScript: async () => [{result: {page: 'https://site.example/watch?id=1', items: [], frames: ['https://player.example/embed/1', 'https://site.example/inner']}}]}});
 assert.deepEqual(await iframe('https://site.example/watch?id=1', 5), {media: null, reason: 'no-access', origin: 'https://player.example'}, 'a player frame we could not enter asks for that site');
 const denied = createMediaSniffer({...api, scripting: {executeScript: async () => { throw new Error('Cannot access contents of the page'); }}});
 assert.deepEqual(await denied('https://site.example/watch?id=1', 5), {media: null, reason: 'no-access', origin: 'https://site.example'});
});

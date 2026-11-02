// Google IMA 가 광고 영상을 시작하지 않고 본영상을 이어서 재생하라고 알린다.
(function () {
  'use strict';
  if (window.google && window.google.ima && window.google.ima.AdsLoader) return;
  var bag = {};
  function on(type, fn) {
    (bag[type] = bag[type] || []).push(fn);
  }
  function emit(type) {
    (bag[type] || []).slice().forEach(function (fn) {
      try {
        fn({
          type: type,
          getAd: function () { return null; },
          getAdsManager: function () { return api; },
          getError: function () {
            return {getErrorCode: function () { return 303; }, getMessage: function () { return ''; }};
          }
        });
      } catch (e) { /* 플레이어 쪽 처리 오류는 광고 스텁이 삼킨다 */ }
    });
  }
  var api = new Proxy({}, {
    get: function (_, prop) {
      if (prop === 'addEventListener') return function (type, fn) { on(type, fn); };
      if (prop === 'removeEventListener') return function () {};
      if (prop === 'getSettings') return function () { return api; };
      if (prop === 'getVolume') return function () { return 1; };
      if (prop === 'getCuePoints' || prop === 'getCompanionAds') return function () { return []; };
      if (prop === 'getRemainingTime') return function () { return 0; };
      if (prop === 'getAdSkippableState') return function () { return true; };
      if (prop === 'requestAds') return function () {
        setTimeout(function () { emit('adError'); emit('contentResumeRequested'); emit('allAdsCompleted'); }, 0);
      };
      if (prop === 'start' || prop === 'init') return function () {
        setTimeout(function () { emit('contentResumeRequested'); emit('allAdsCompleted'); }, 0);
      };
      if (prop === 'AdsLoader' || prop === 'AdDisplayContainer' || prop === 'AdsRequest' || prop === 'AdsRenderingSettings') {
        function Ctor() { return api; }
        return Ctor;
      }
      if (prop === 'AdEvent' || prop === 'AdErrorEvent' || prop === 'AdsManagerLoadedEvent') {
        function Ev(type) { this.type = type; }
        Ev.Type = new Proxy({}, {get: function (__, key) { return String(key); }});
        Ev.prototype.getAdsManager = function () { return api; };
        Ev.prototype.getError = function () { return {getErrorCode: function () { return 303; }}; };
        return Ev;
      }
      if (prop === 'ViewMode') return {NORMAL: 'NORMAL', FULLSCREEN: 'FULLSCREEN'};
      if (prop === 'VERSION') return '0';
      if (prop === 'settings') return api;
      return function () { return api; };
    }
  });
  window.google = window.google || {};
  window.google.ima = api;
})();

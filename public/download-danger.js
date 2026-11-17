// BongExtend 다운로더: 크롬이 '위험할 수 있는 파일'이나 '검사 필요'로 붙잡아 둔 다운로드를 알아봐요.
// 크롬 기본 다운로드 표시를 우리 다운로더로 바꿔 두면 크롬의 확인 창이 안 보여서, 100%에서 멈춘 채 저장도 실행도 안 돼요.
// 이 파일은 다운로더 팝업 · 상세 관리 화면이 함께 써요(전역 BongDownloadDanger).
(function (root) {
  'use strict';
  // 받을지 사용자가 정해야 하는 경고: '그래도 받기'(chrome.downloads.acceptDanger)로 크롬 확인 창을 띄울 수 있어요.
  const WARN = {
    file: '이 종류의 파일(실행 파일 등)은 PC에 해를 줄 수 있다고 크롬이 확인을 요청했어요.',
    uncommon: '흔히 받는 파일이 아니라서 크롬이 확인을 요청했어요.',
    url: '크롬이 위험한 사이트에서 온 파일로 표시했어요.',
    content: '크롬이 위험한 파일로 표시했어요.',
    host: '크롬이 위험한 파일을 퍼뜨린 적 있는 사이트로 표시했어요.',
    unwanted: '크롬이 원치 않는 프로그램일 수 있다고 표시했어요.',
    accountCompromise: '크롬이 계정 정보를 노리는 파일일 수 있다고 표시했어요.',
    sensitiveContentWarning: '조직 정책이 민감한 내용이 있다고 확인을 요청했어요.',
    deepScannedFailed: '크롬이 파일 검사를 끝내지 못했어요.',
    promptForScanning: '크롬이 이 파일을 검사할지 묻고 있어요. 검사하려면 크롬 다운로드 화면(Ctrl+J)에서 할 수 있어요.',
    promptForLocalPasswordScanning: '암호가 걸린 파일이라 크롬이 검사할지 묻고 있어요. 검사하려면 크롬 다운로드 화면(Ctrl+J)에서 할 수 있어요.'
  };
  // 크롬이 검사하는 중: 기다리면 저절로 끝나요.
  const SCANNING = {
    asyncScanning: '크롬이 파일을 검사하는 중이에요. 끝나면 저절로 저장돼요.',
    asyncLocalPasswordScanning: '크롬이 파일을 검사하는 중이에요. 끝나면 저절로 저장돼요.'
  };
  // 정책 · 검사 결과로 막힌 파일: 받을 수 없고 버리기만 할 수 있어요.
  const BLOCKED = {
    passwordProtected: '암호가 걸린 파일이라 조직 정책이 막았어요.',
    blockedTooLarge: '파일이 너무 커서 조직 정책이 막았어요.',
    sensitiveContentBlock: '민감한 내용이 있어 조직 정책이 막았어요.',
    blockedScanFailed: '검사에 실패해서 조직 정책이 막았어요.'
  };

  // 다운로드 하나 → null(상관없음) 또는 {kind: 'warn'|'scanning'|'blocked', short, detail, canKeep}
  function dangerHold(item) {
    if (!item || item.state !== 'in_progress') return null;
    const type = String(item.danger || '');
    if (WARN[type]) return {kind: 'warn', short: '확인 필요', detail: WARN[type], canKeep: true};
    if (SCANNING[type]) return {kind: 'scanning', short: '검사 중', detail: SCANNING[type], canKeep: false};
    if (BLOCKED[type]) return {kind: 'blocked', short: '차단됨', detail: BLOCKED[type], canKeep: false};
    return null;
  }

  // 알림을 띄울 만한 변화인지(확인이 필요해졌을 때만).
  const needsDecision = item => dangerHold(item)?.kind === 'warn';

  root.BongDownloadDanger = {dangerHold, needsDecision};
})(typeof globalThis !== 'undefined' ? globalThis : this);

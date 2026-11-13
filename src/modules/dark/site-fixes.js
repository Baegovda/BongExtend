// Homepage toolbar icons are monochrome sprites, not inherited text colors.
// Limit the correction to dark mode so photos, logos and light-mode colors remain intact.
const NAVER_HOME_FIXES = Object.freeze({
  invert: [],
  css: `
html[data-darkreader-scheme="dark"] {
  --color-neutral-foreground-default: #e8e6e3 !important;
  --color-neutral-foreground-alpha: #c5cbd4 !important;
  --darkreader-text--color-neutral-foreground-alpha: #c5cbd4 !important;
  --color-neutral-foreground-decorative-1: #c5cbd4 !important;
  --color-neutral-foreground-decorative-2: #b8c0cc !important;
  --darkreader-text--color-neutral-foreground-decorative-1: #c5cbd4 !important;
  --darkreader-text--color-neutral-foreground-decorative-2: #b8c0cc !important;
  --color-neutral-foreground-subtle-1: #d5d9df !important;
  --color-neutral-foreground-subtle-2: #c5cbd4 !important;
  --color-neutral-foreground-subtle-3: #b8c0cc !important;
  --darkreader-text--color-neutral-foreground-default: #e8e6e3 !important;
  --darkreader-text--color-neutral-foreground-subtle-1: #d5d9df !important;
  --darkreader-text--color-neutral-foreground-subtle-2: #c5cbd4 !important;
  --darkreader-text--color-neutral-foreground-subtle-3: #b8c0cc !important;
}
html[data-darkreader-scheme="dark"] #header :is(.btn_menu, .link_pay, .btn_notify, .link_shopping)::after,
html[data-darkreader-scheme="dark"] #account [class*="btn_logout"]::after {
  filter: brightness(0) invert(0.88) !important;
}
html[data-darkreader-scheme="dark"] #account :is([class*="btn_logout"], [class*="link_more"]) {
  color: #c5cbd4 !important;
}
/* Public main CSS: neutral labels can inherit a locally scoped foreground variable.
   Keep counts/status colors and photo/weather/brand imagery untouched. */
html[data-darkreader-scheme="dark"] #account :is([class*="nickname___"], [class*="user_desc___"], [class*="item_link___"], [class*="link_new___"]),
html[data-darkreader-scheme="dark"] [class*="DailyBoardView-module__"]:is([class*="btn_location___"], [class*="header_aside___"], [class*="weather_status___"], [class*="time___"]) {
  color: #d5d9df !important;
}
/* 첫 화면 카드는 테두리가 아니라 box-shadow 1px 고리로 그려져요. 어두운 배경에서는 그 고리가 흐려지고
   안쪽 아래 줄(메일·카페·블로그·페이)이 잘려 보여서, 카드 전체에 같은 밝기의 고리를 명확히 그려요. */
html[data-darkreader-scheme="dark"] [class*="Layout-module__content_area___"] {
  box-shadow: 0 0 0 1px #3d434a !important;
}
html[data-darkreader-scheme="dark"] [class*="Layout-module__content_area___"] [class*="MyView-module__menu_area___"] {
  box-shadow: none !important;
}
/* 사용자 요청으로 예외: 검색창 왼쪽 로고 자리에 겹친 흰 칸(흰 배경 그림)을 숨겨요. N 모양은 그대로예요. */
html[data-darkreader-scheme="dark"] .search_logo .link_naver.type_motion_n :is(img, canvas, video, picture, object),
html[data-darkreader-scheme="dark"] .search_logo .link_naver.type_motion_n::before,
html[data-darkreader-scheme="dark"] .search_logo .link_naver.type_motion_n::after {
  display: none !important;
}
/* 탭·뉴스 영역의 세로 구분선과 점 구분 표시도 검정 15% 투명이라 어두운 배경에서 안 보여요 */
html[data-darkreader-scheme="dark"] [class*="ContentHeaderView-module__tab_item___"]::before,
html[data-darkreader-scheme="dark"] [class*="ContentHeaderView-module__tab_text___"]::before,
html[data-darkreader-scheme="dark"] [class*="ContentHeaderSubView-module__sub_news___"]::before,
html[data-darkreader-scheme="dark"] [class*="ContentHeaderSubView-module__link_home___"]::before,
html[data-darkreader-scheme="dark"] [class*="ContentHeaderSubView-module__news_media___"]::after,
html[data-darkreader-scheme="dark"] [class*="MediaNewsView-module__news_text___"]::before {
  background-color: rgba(255, 255, 255, 0.22) !important;
}
/* 날씨 카드 제목 아래 구분선(info_group 위쪽 테두리)이 투명도 8%라 어두운 배경에서 흐려요 */
html[data-darkreader-scheme="dark"] [class*="DailyBoardView-module__info_group___"] {
  border-top-color: #3d434a !important;
}
/* 날씨 시간별 세로 눈금선은 검정 8% 투명이라 어두운 배경에서 안 보여요. 밝은 반투명 선으로 */
html[data-darkreader-scheme="dark"] [class*="DailyBoardView-module__celsius___"]::before {
  background-color: rgba(255, 255, 255, 0.22) !important;
}
html[data-darkreader-scheme="dark"] #account :is([class*="thumb_setting___"], [class*="btn_next___"], [class*="btn_prev___"])::before,
html[data-darkreader-scheme="dark"] [class*="SettingView-module__btn_setting___"]::before {
  filter: brightness(0) invert(0.88) !important;
}
`,
  ignoreInlineStyle: [],
  ignoreImageAnalysis: [],
  disableStyleSheetsProxy: false,
  ignoreCSSUrl: []
});

// 네이버 메일: 왼쪽 메뉴·위쪽 아이콘은 어두운 회색 svg_* 아이콘이라 어두운 배경에서 안 보여요.
// 글자는 건드리지 않고(가상 요소, 글자 없는 아이콘 칸만), 색 있는 아이콘은 색조를 유지해요.
const NAVER_MAIL_FIXES = Object.freeze({
  invert: [],
  css: `
html[data-darkreader-scheme="dark"] [class*="svg_"]::before,
html[data-darkreader-scheme="dark"] [class*="svg_"]::after,
html[data-darkreader-scheme="dark"] [class*="svg_"]:empty,
/* 위쪽 서비스 아이콘 줄과, 보이는 글자 없이 .blind 글자만 가진 아이콘 단추/링크 */
html[data-darkreader-scheme="dark"] #gnb_list a,
/* 눈에 보이는 글자가 같이 들어 있는 단추(보낸 사람·메일함 이름 등)는 제외해요 */
html[data-darkreader-scheme="dark"] :is(a, button, label):not(.button_sender, .mailbox_label, .unread_mail, .button_mailbox, .item, [class*="label"], [class*="sender"], [class*="subject"], [class*="text"]):has(> .blind:only-child),
/* 별·중요 표시처럼 안이 비어 있고 이름(aria-label)만 있는 아이콘 단추 */
/* 네이버 공통 상단바(GNB) 아이콘: 톡·알림·화살표처럼 비어 있는 아이콘 칸 */
html[data-darkreader-scheme="dark"] :is(.gnb_icon, .ico_arrow):empty,
html[data-darkreader-scheme="dark"] :is(a, button, label, [role="button"])[aria-label]:empty {
  filter: invert(0.88) hue-rotate(180deg) !important;
}
/* 검색창 안내 글자와 입력 글자가 흐려 안 보이는 것을 밝게 */
html[data-darkreader-scheme="dark"] input::placeholder {
  color: #a3abbc !important;
  opacity: 1 !important;
}
html[data-darkreader-scheme="dark"] input:is([type="search"], [type="text"], :not([type])) {
  color: #e8e6e3 !important;
}
/* 위쪽 서비스 아이콘은 평소 투명도 0.4로 흐리게 그려져서, 밝게 뒤집어도 어두워 보여요 */
html[data-darkreader-scheme="dark"] #gnb_list li:not(._mail) a::before {
  opacity: 0.85 !important;
}
/* 도구 줄 단추 글자(삭제·스팸신고 등)가 어둡게 남는 것을 밝은 중립색으로 */
html[data-darkreader-scheme="dark"] :is(button, a, [role="button"], [class*="button"], [class*="btn"]) .text {
  color: #d5d9df !important;
}
`,
  ignoreInlineStyle: [],
  ignoreImageAnalysis: [],
  disableStyleSheetsProxy: false,
  ignoreCSSUrl: []
});

// 네이버 쇼핑 상단(GNB)의 NAVER·Npay 로고는 svg 모양 자체가 어두운 회색이라 어두운 배경에서 안 보여요.
const NAVER_SHOPPING_FIXES = Object.freeze({
  invert: [],
  css: `
html[data-darkreader-scheme="dark"] [class*="_gnbHeader_icon_"] path {
  fill: #d5d9df !important;
}
html[data-darkreader-scheme="dark"] [class*="_gnbHeader_link_"] {
  color: #d5d9df !important;
}
`,
  ignoreInlineStyle: [],
  ignoreImageAnalysis: [],
  disableStyleSheetsProxy: false,
  ignoreCSSUrl: []
});

// Naver Search fix copied from Dark Reader's MIT-licensed dynamic-theme-fixes.config.
// https://github.com/darkreader/darkreader/blob/main/src/config/dynamic-theme-fixes.config
const NAVER_SEARCH_FIXES = Object.freeze({
  invert: [],
  css: "i.spnew2 { color: transparent !important; }",
  ignoreInlineStyle: [],
  ignoreImageAnalysis: [],
  disableStyleSheetsProxy: false,
  ignoreCSSUrl: []
});


// Keep the existing site-specific stylesheet proxy exclusions.
const FAB_CSP_FIXES = Object.freeze({
  invert: [],
  css: "",
  ignoreInlineStyle: [],
  ignoreImageAnalysis: [],
  disableStyleSheetsProxy: true,
  disableInlineScriptInjection: true,
  ignoreCSSUrl: []
});

const TAOBAO_CSP_FIXES = Object.freeze({
  invert: [],
  css: "",
  ignoreInlineStyle: [],
  ignoreImageAnalysis: [],
  disableStyleSheetsProxy: true,
  disableInlineScriptInjection: true,
  ignoreCSSUrl: []
});

// Coupang's official Dark Reader site fixes preserve its category control and header icons.
const COUPANG_FIXES = Object.freeze({
  invert: [
    ".select--category--button",
    'img[src="https://static.coupangcdn.com/image/coupang/common/pc_header_img_sprite_new_gnb.svg#person"]',
    'img[src="https://static.coupangcdn.com/image/coupang/common/pc_header_img_sprite_new_gnb.svg#cart"]',
    ".main-section h2",
    "#categoryBestMenu > .category-anchor",
    ".category-best-title-ad-product"
  ],
  css: "",
  ignoreInlineStyle: [],
  ignoreImageAnalysis: [],
  disableStyleSheetsProxy: false,
  ignoreCSSUrl: []
});

export const darkReaderFixesForSite = (hostname) => {
  const host = String(hostname || "").toLowerCase().replace(/^www\./, "");
  if (host === "naver.com") return NAVER_HOME_FIXES;
  if (host === "mail.naver.com") return NAVER_MAIL_FIXES;
  if (host === "shopping.naver.com") return NAVER_SHOPPING_FIXES;
  if (host === "search.naver.com" || host === "m.search.naver.com") return NAVER_SEARCH_FIXES;
  if (host === "coupang.com" || host.endsWith(".coupang.com")) return COUPANG_FIXES;
  if (host === "fab.com" || host.endsWith(".fab.com")) return FAB_CSP_FIXES;
  if (host === "taobao.com" || host.endsWith(".taobao.com")) return TAOBAO_CSP_FIXES;
  return undefined;
};

// The page's native text is already themed before translation reads its colors.
// Preserve the deliberate pastel/prism colors in the temporary effect layers.
export const withTranslationColors = (fixes) => ({
  ...fixes,
  // The packaged MAIN-world content script supplies the upstream proxy without inline scripts.
  disableInlineScriptInjection: true,
  // Artwork is never globally inverted/hidden. Small transparent controls are
  // examined separately by the bounded local bitmap contrast controller.
  ignoreImageAnalysis: ['*', ...(fixes?.ignoreImageAnalysis || [])],
  // Helpers own only their individual inline !important properties. Excluding
  // their whole element would remove upstream theming of unrelated borders,
  // shadows and author colors, exposing original white separators.
  // Retain isolation only for owned SVG glyph paint: upstream's SVG attribute
  // path otherwise interferes with the explicit fill/stroke repair. HTML card
  // and icon containers still receive normal upstream boundary theming.
  ignoreInlineStyle: [...(fixes?.ignoreInlineStyle || []), '.pt-page-translator-sweep', '.pt-page-translator-sweep *', 'svg[data-bong-contrast-owned="1"]', 'svg [data-bong-contrast-owned="1"]'],
});

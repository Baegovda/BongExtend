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
html[data-darkreader-scheme="dark"] [class*="svg_"]:empty {
  filter: invert(0.88) hue-rotate(180deg) !important;
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

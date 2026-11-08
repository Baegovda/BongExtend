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
  ignoreInlineStyle: [...(fixes?.ignoreInlineStyle || []), '.pt-page-translator-sweep', '.pt-page-translator-sweep *'],
});

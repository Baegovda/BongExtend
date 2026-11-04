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

// Fab blocks Dark Reader's temporary inline proxy script with its CSP. The generated
// dark styles still work without that proxy, but dynamic stylesheet tracking is reduced.
const FAB_CSP_FIXES = Object.freeze({
  invert: [],
  css: "",
  ignoreInlineStyle: [],
  ignoreImageAnalysis: [],
  disableStyleSheetsProxy: true,
  disableInlineScriptInjection: true,
  ignoreCSSUrl: []
});

export const darkReaderFixesForSite = (hostname) => {
  const host = String(hostname || "").toLowerCase().replace(/^www\./, "");
  if (host === "search.naver.com" || host === "m.search.naver.com") return NAVER_SEARCH_FIXES;
  if (host === "fab.com" || host.endsWith(".fab.com")) return FAB_CSP_FIXES;
  return undefined;
};

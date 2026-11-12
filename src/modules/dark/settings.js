export const DARK_SETTINGS_KEY = "core.darkMode";
export const DARK_SCRIPT_ID = "bongextend-dark-reader";
export const DARK_SCRIPT_FILE = "content-scripts/dark.js";
export const DARK_PROXY_SCRIPT_ID = "bongextend-dark-reader-proxy";
export const DARK_PROXY_SCRIPT_FILE = "content-scripts/dark-proxy.js";

export const DEFAULT_DARK_SETTINGS = Object.freeze({
  enabledByDefault: false,
  enabledSites: [],
  disabledSites: [],
  siteListMode: "exclude",
  siteList: [],
  siteThemes: {},
  followSystem: false,
  mode: 1,
  brightness: 100,
  contrast: 100,
  sepia: 0,
  grayscale: 0,
  useFont: false,
  fontFamily: "",
  textStroke: 0,
  darkSchemeBackgroundColor: "#181a1b",
  darkSchemeTextColor: "#e8e6e3",
  styleSystemControls: true
});

const clamp = (value, min, max, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};

export const normalizeDarkHost = (value) => {
  const host = String(value || "").trim().toLowerCase().replace(/^\*\./, "").replace(/^www\./, "");
  if (!host || host.length > 253 || !/^[a-z0-9.-]+$/.test(host) || host.includes("..")) return "";
  return host;
};

const normalizeHost = normalizeDarkHost;

const normalizeHosts = (value) => Array.isArray(value)
  ? [...new Set(value.map(normalizeHost).filter(Boolean))].slice(0, 200)
  : [];

const normalizeColor = (value, fallback) => /^#[0-9a-f]{6}$/i.test(String(value || "")) ? value : fallback;

const normalizeTheme = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out = {};
  for (const key of ["mode", "brightness", "contrast", "sepia", "grayscale", "useFont", "fontFamily", "textStroke", "darkSchemeBackgroundColor", "darkSchemeTextColor"]) {
    if (value[key] === undefined) continue;
    if (key === "mode") out.mode = Number(value.mode) === 0 ? 0 : 1;
    else if (key === "brightness" || key === "contrast") out[key] = clamp(value[key], 50, 120, DEFAULT_DARK_SETTINGS[key]);
    else if (key === "sepia" || key === "grayscale") out[key] = clamp(value[key], 0, 100, DEFAULT_DARK_SETTINGS[key]);
    else if (key === "useFont") out.useFont = Boolean(value.useFont);
    else if (key === "fontFamily") out.fontFamily = String(value.fontFamily || "").replace(/[\r\n{};]/g, "").slice(0, 60);
    else if (key === "textStroke") out.textStroke = clamp(value.textStroke, 0, 1, 0);
    else if (key === "darkSchemeBackgroundColor") out[key] = normalizeColor(value[key], DEFAULT_DARK_SETTINGS[key]);
    else if (key === "darkSchemeTextColor") out[key] = normalizeColor(value[key], DEFAULT_DARK_SETTINGS[key]);
  }
  return out;
};

export const normalizeDarkSettings = (value) => {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const siteThemes = {};
  if (source.siteThemes && typeof source.siteThemes === "object" && !Array.isArray(source.siteThemes)) {
    for (const [host, theme] of Object.entries(source.siteThemes).slice(0, 200)) {
      const normalizedHost = normalizeHost(host);
      if (normalizedHost) siteThemes[normalizedHost] = normalizeTheme(theme);
    }
  }
  return {
    ...DEFAULT_DARK_SETTINGS,
    enabledByDefault: Boolean(source.enabledByDefault),
    enabledSites: normalizeHosts(source.enabledSites),
    disabledSites: normalizeHosts(source.disabledSites),
    siteListMode: source.siteListMode === "only" ? "only" : "exclude",
    siteList: normalizeHosts(source.siteList),
    siteThemes,
    followSystem: Boolean(source.followSystem),
    ...normalizeTheme(source)
  };
};

export const darkSiteEnabled = (settings, hostname) => {
  const host = normalizeHost(hostname);
  if (!host) return false;
  // 켬/끔 목록에서 이 주소에 해당하는 규칙 중 가장 구체적인(긴) 것이 이겨요. 예: google.com을 꺼도 mail.google.com을 따로 켜면 켜져요.
  const mostSpecific = (sites) => sites.filter((site) => host === site || host.endsWith(`.${site}`)).reduce((best, site) => (site.length > best.length ? site : best), "");
  const disabledRule = mostSpecific(normalizeHosts(settings?.disabledSites));
  const enabledRule = mostSpecific(normalizeHosts(settings?.enabledSites));
  if (disabledRule || enabledRule) return enabledRule.length > disabledRule.length;
  const listed = normalizeHosts(settings?.siteList);
  const onList = listed.some((site) => host === site || host.endsWith(`.${site}`));
  if (settings?.siteListMode === "only" && !onList) return false;
  if (settings?.siteListMode !== "only" && onList) return false;
  return Boolean(settings?.enabledByDefault);
};

export const darkSitePattern = (hostname) => {
  const host = normalizeHost(hostname);
  if (!host) return [];
  const wildcard = host.includes(".") ? `*.${host}` : host;
  return [`https://${wildcard}/*`, `http://${wildcard}/*`];
};

export const darkThemeForSite = (settings, hostname) => {
  const host = normalizeHost(hostname);
  return {...settings, ...(host && settings?.siteThemes?.[host] ? settings.siteThemes[host] : {})};
};

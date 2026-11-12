// 이미지 도구 막대: 사진 위에 마우스를 올리면 나오는 이미지 검색·다운로드·복사 메뉴의 순수 로직.
// 이미지 주소만 다뤄요. 이미지 내용은 사용자가 '이미지 복사'를 누를 때만 이 PC 안에서 가져와요.

export const IMAGE_SETTINGS_KEY = "image.settings";
export const TOOLBAR_SCRIPT_ID = "bongextend-image-toolbar";
export const TOOLBAR_SCRIPT_FILE = "content-scripts/image-toolbar.js";
export const MIN_IMAGE_SIZE = 140;
export const MAX_FETCH_BYTES = 20 * 1024 * 1024;

// url 방식: {url}이 이미지 주소로 바뀌어요. site 방식: 사이트를 열고 그 사이트의 '이미지로 검색'에 사진을 넣어요(백그라운드가 처리).
export const DEFAULT_ENGINES = [
    {id: "lens", name: "Google 렌즈", url: "https://lens.google.com/uploadbyurl?url={url}"},
    {id: "aliexpress", name: "알리익스프레스", site: "aliexpress"},
    {id: "taobao", name: "타오바오", site: "taobao"}
];
export const SITE_SEARCH_ENGINES = DEFAULT_ENGINES.filter((engine) => engine.site).map((engine) => engine.site);

const HTTPS_TEMPLATE = /^https:\/\/[^\s]+\{url\}[^\s]*$/;

export const normalizeToolbarSettings = (value) => {
    // 끈 엔진만 기억해요. 새 엔진이 생겨도 기본으로 켜져 있어요.
    const disabledEngines = Array.isArray(value?.disabledEngines) ? value.disabledEngines.filter((id) => DEFAULT_ENGINES.some((engine) => engine.id === id)) : [];
    const custom = (Array.isArray(value?.custom) ? value.custom : [])
        .filter((row) => row && typeof row.name === "string" && typeof row.url === "string" && row.name.trim() && HTTPS_TEMPLATE.test(row.url.trim()))
        .slice(0, 10)
        .map((row) => ({name: row.name.trim().slice(0, 24), url: row.url.trim().slice(0, 600)}));
    const hiddenHosts = (Array.isArray(value?.hiddenHosts) ? value.hiddenHosts : []).filter((host) => typeof host === "string" && /^[a-z0-9.-]{1,253}$/.test(host)).slice(0, 200);
    return {toolbar: value?.toolbar !== false, disabledEngines, custom, hiddenHosts};
};

// 사용 중인 검색 엔진 목록(기본 + 사용자 추가).
export const activeEngines = (settings) => {
    const normalized = normalizeToolbarSettings(settings);
    return [
        ...DEFAULT_ENGINES.filter((engine) => !normalized.disabledEngines.includes(engine.id)),
        ...normalized.custom.map((row, index) => ({id: `custom-${index}`, name: row.name, url: row.url}))
    ];
};

export const buildEngineUrl = (template, imageUrl) => {
    if (!HTTPS_TEMPLATE.test(String(template || ""))) return "";
    if (!/^https?:\/\//i.test(String(imageUrl || ""))) return "";
    return template.replace("{url}", encodeURIComponent(imageUrl));
};

// "이름|https://…{url}…" 줄을 읽어요. 잘못된 줄은 건너뛰어요.
export const parseCustomEngines = (text) => String(text || "").split(/\r?\n/).map((line) => {
    const at = line.indexOf("|");
    if (at < 1) return null;
    const name = line.slice(0, at).trim(), url = line.slice(at + 1).trim();
    return name && HTTPS_TEMPLATE.test(url) ? {name, url} : null;
}).filter(Boolean).slice(0, 10);

export const formatCustomEngines = (custom) => (custom || []).map((row) => `${row.name}|${row.url}`).join("\n");

// 도구 막대를 보여줄 만큼 큰 사진인지.
export const isEligibleImage = ({width, height, naturalWidth = width, naturalHeight = height}) =>
    width >= MIN_IMAGE_SIZE && height >= MIN_IMAGE_SIZE && naturalWidth >= 200 && naturalHeight >= 200;

export const imageSource = (img) => {
    const value = String(img?.currentSrc || img?.src || "");
    return /^https?:\/\//i.test(value) ? value : "";
};

// 썸네일 주소에서 원본 주소를 추정해요. 모르는 형태는 그대로 돌려줘요.
export function originalImageUrl(src) {
    let url;
    try { url = new URL(src); } catch { return src; }
    // 알리익스프레스 등: abc.jpg_640x640q90.jpg_.webp → abc.jpg
    url.pathname = url.pathname.replace(/(\.(?:jpe?g|png|webp|gif))_[0-9]+x[0-9]+[^/]*$/i, "$1").replace(/(\.(?:jpe?g|png|webp|gif))_\.(?:avif|webp)$/i, "$1");
    // 네이버 쇼핑·블로그 이미지 서버: ?type=m510 같은 축소 옵션 제거
    if (/(^|\.)pstatic\.net$/i.test(url.hostname)) url.searchParams.delete("type");
    // 이미지 크기를 줄이는 흔한 조회 옵션
    for (const key of ["w", "h", "width", "height", "resize", "quality"]) url.searchParams.delete(key);
    return url.toString();
}

export function filenameFromUrl(src, fallback = "image") {
    let name = "";
    try { name = decodeURIComponent(new URL(src).pathname.split("/").filter(Boolean).pop() || ""); } catch { name = ""; }
    name = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").replace(/\s+/g, " ").trim().slice(0, 100);
    if (!name) name = fallback;
    if (!/\.(jpe?g|png|webp|gif|avif|bmp|svg)$/i.test(name)) name += ".jpg";
    return name;
}

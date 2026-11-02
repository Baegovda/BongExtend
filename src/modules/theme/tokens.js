// 화면 토큰. BongHub 저장소는 이 환경에서 열리지 않아, iOS 그룹 배경·시스템 글자색을 기준으로 했다.
// theme.css 의 같은 이름 변수와 숫자를 맞춘다. 대비 테스트가 둘을 비교한다.

export const EASE = "cubic-bezier(0.25, 0.1, 0.25, 1)";
export const DURATION_MS = 250;
export const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif';
export const BAR_ALPHA = 0.94;

export const themes = {
    dark: {
        bg: "#000000",
        surface: "#1c1c1e",
        surface2: "#2c2c2e",
        surface3: "#3a3a3c",
        border: "#3a3a3c",
        borderStrong: "#48484a",
        text: "#ffffff",
        text2: "#e5e5ea",
        muted: "#aeaeb2",
        accent: "#0068d0",
        accentHover: "#0070e0",
        accentInk: "#ffffff",
        link: "#64d2ff",
        ok: "#30d158",
        warn: "#ffd60a",
        error: "#ff6961",
        separator: "#38383a"
    },
    light: {
        bg: "#f2f2f7",
        surface: "#ffffff",
        surface2: "#ffffff",
        surface3: "#e5e5ea",
        border: "#d1d1d6",
        borderStrong: "#c7c7cc",
        text: "#1c1c1e",
        text2: "#3a3a3c",
        muted: "#636366",
        accent: "#0057c2",
        accentHover: "#004aab",
        accentInk: "#ffffff",
        link: "#0040dd",
        ok: "#1b7f37",
        warn: "#8a5a00",
        error: "#d70015",
        separator: "#d1d1d6"
    }
};

// 본문으로 쓰이는 글자/바탕 짝. 힌트(12px)도 굵은 큰 글자가 아니라서 4.5:1 이다.
export const bodyPairs = [
    ["text", "bg"],
    ["text", "surface"],
    ["text", "surface2"],
    ["text2", "bg"],
    ["text2", "surface"],
    ["text2", "surface2"],
    ["muted", "bg"],
    ["muted", "surface"],
    ["muted", "surface2"],
    ["link", "bg"],
    ["link", "surface"],
    ["accentInk", "accent"],
    ["ok", "bg"],
    ["ok", "surface"],
    ["warn", "bg"],
    ["warn", "surface"],
    ["error", "bg"],
    ["error", "surface"]
];

export const MIN_BODY_CONTRAST = 4.5;

const cssName = {
    bg: "--be-bg",
    surface: "--be-surface",
    surface2: "--be-surface-2",
    surface3: "--be-surface-3",
    border: "--be-border",
    borderStrong: "--be-border-strong",
    text: "--be-text",
    text2: "--be-text-2",
    muted: "--be-muted",
    accent: "--be-accent",
    accentHover: "--be-accent-hover",
    accentInk: "--be-accent-ink",
    link: "--be-link",
    ok: "--be-ok",
    warn: "--be-warn",
    error: "--be-error",
    separator: "--be-separator"
};

export const tokenCssNames = cssName;

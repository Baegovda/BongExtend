// BongExtend: 깊이 있는 유리 면과 진주빛 청색·보라·청록을 위한 공통 토큰.
// theme.css 의 같은 이름 변수와 숫자를 맞춘다. 대비 테스트가 둘을 비교한다.

export const EASE = "cubic-bezier(0.25, 0.1, 0.25, 1)";
export const DURATION_MS = 250;
export const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif';
export const BAR_ALPHA = 0.94;

export const themes = {
    dark: {
        bg: "#0b0d12",
        surface: "#151821",
        surface2: "#1b1f2a",
        surface3: "#3a3f4d",
        border: "#2a2e3a",
        borderStrong: "#4a5062",
        text: "#f5f7fa",
        text2: "#dce0e8",
        muted: "#a3abbc",
        accent: "#3d63bd",
        accentHover: "#3557a6",
        accentInk: "#ffffff",
        link: "#adc7fa",
        ok: "#95d5b2",
        warn: "#e8cf92",
        error: "#f3aaa7",
        separator: "#2a2e3a"
    },
    light: {
        bg: "#f3f4f6",
        surface: "#fcfcfd",
        surface2: "#f1f2f4",
        surface3: "#e5e7eb",
        border: "#d0d3da",
        borderStrong: "#a9aeb9",
        text: "#24262d",
        text2: "#41444f",
        muted: "#606570",
        accent: "#3b5fba",
        accentHover: "#304e99",
        accentInk: "#ffffff",
        link: "#3558ac",
        ok: "#28674a",
        warn: "#7c5b16",
        error: "#a43c3c",
        separator: "#dedfe4"
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

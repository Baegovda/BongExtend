// BongExtend: 깊이 있는 유리 면과 진주빛 청색·보라·청록을 위한 공통 토큰.
// theme.css 의 같은 이름 변수와 숫자를 맞춘다. 대비 테스트가 둘을 비교한다.

export const EASE = "cubic-bezier(0.25, 0.1, 0.25, 1)";
export const DURATION_MS = 250;
export const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif';
export const BAR_ALPHA = 0.94;

export const themes = {
    dark: {
        bg: "#0c1019",
        surface: "#181e2c",
        surface2: "#20293a",
        surface3: "#2c374c",
        border: "#36435b",
        borderStrong: "#51617b",
        text: "#f4f6ff",
        text2: "#d8e0f0",
        muted: "#abb8cd",
        accent: "#405fc4",
        accentHover: "#405bb4",
        accentInk: "#ffffff",
        link: "#acc7ff",
        ok: "#7ce0be",
        warn: "#f4d49c",
        error: "#ffadae",
        separator: "#303c52"
    },
    light: {
        bg: "#eef1f8",
        surface: "#f9fbff",
        surface2: "#edf2fa",
        surface3: "#e0e7f3",
        border: "#c6d0e0",
        borderStrong: "#a4b1c7",
        text: "#192239",
        text2: "#34425c",
        muted: "#53617a",
        accent: "#455cc2",
        accentHover: "#354cac",
        accentInk: "#ffffff",
        link: "#3757b6",
        ok: "#206a53",
        warn: "#80601f",
        error: "#aa3447",
        separator: "#d5ddea"
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

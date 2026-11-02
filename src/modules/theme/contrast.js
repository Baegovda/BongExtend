// WCAG 2.1 상대 휘도와 대비율. 본문 글자는 4.5:1 이상이어야 한다.

const channel = (value) => {
    const scaled = value / 255;
    return scaled <= 0.04045 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
};

export const hexToRgb = (hex) => {
    const raw = String(hex || "").replace("#", "");
    const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
    const n = Number.parseInt(full, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export const rgbToHex = (rgb) => `#${rgb.map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0")).join("")}`;

export const luminance = (hex) => {
    const [r, g, b] = hexToRgb(hex);
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

export const contrastRatio = (foreground, background) => {
    const lighter = Math.max(luminance(foreground), luminance(background));
    const darker = Math.min(luminance(foreground), luminance(background));
    return (lighter + 0.05) / (darker + 0.05);
};

// 반투명 막이 검은색 또는 흰색 위에 올라간 실제 색. 대비는 이 불투명 색으로 본다.
export const composite = (top, bottom, alpha) => {
    const above = hexToRgb(top);
    const under = hexToRgb(bottom);
    return rgbToHex(above.map((value, index) => value * alpha + under[index] * (1 - alpha)));
};

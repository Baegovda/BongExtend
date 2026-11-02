// 계정마다 고정된 강조색. 흰 글자가 그 색 위에서 4.5:1 이 되는 색만 쓴다.

import {contrastRatio} from "../theme/contrast.js";

export const ACCOUNT_COLORS = ["#0057c2", "#722dde", "#0f766e", "#a13b19", "#ab255b", "#1d4ed8", "#7c3aed", "#b91c1c"];

const HEX = /^#[0-9a-fA-F]{6}$/;

export const accountInitial = (email) => {
    const text = String(email || "").trim();
    return (text[0] || "?").toUpperCase();
};

const readableOnWhite = (color) => {
    try { return contrastRatio("#ffffff", color) >= 4.5; }
    catch { return false; }
};

export const accountColor = (email, overrides) => {
    const key = String(email || "").trim().toLowerCase();
    const custom = overrides && overrides[key];
    if (typeof custom === "string" && HEX.test(custom) && readableOnWhite(custom)) return custom.toLowerCase();
    let hash = 0;
    for (const char of key) hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
    return ACCOUNT_COLORS[hash % ACCOUNT_COLORS.length];
};

export const originOf = (url) => {
    try {
        const parsed = new URL(String(url || ""));
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
        return parsed.origin;
    } catch {
        return "";
    }
};

export const originPattern = (origin) => origin ? `${origin}/*` : "";

export const nextOrigins = (saved, origin, enabled) => {
    const list = Array.isArray(saved) ? saved.filter((item) => typeof item === "string" && item) : [];
    const next = new Set(list);
    if (enabled) next.add(origin);
    else next.delete(origin);
    return [...next].sort();
};

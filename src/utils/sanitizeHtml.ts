// 디시 미리보기용. 글 모양(이미지, 줄바꿈, 링크)은 두고 스크립트와 이벤트 속성은 뺀다.

const ALLOWED_TAGS = new Set([
    "A", "B", "BR", "DIV", "EM", "I", "IMG", "P", "SPAN", "STRONG", "U",
    "VIDEO", "AUDIO", "SOURCE", "FONT", "STRIKE", "S", "BLOCKQUOTE",
    "UL", "OL", "LI", "TABLE", "THEAD", "TBODY", "TR", "TD", "TH",
    "H1", "H2", "H3", "H4", "H5", "H6", "PRE", "HR", "WBR", "SUB", "SUP",
    "FIGURE", "FIGCAPTION"
]);

const DROP_WITH_CHILDREN = new Set([
    "SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "LINK", "META", "FORM",
    "INPUT", "BUTTON", "TEXTAREA", "SELECT", "TEMPLATE", "SVG", "MATH"
]);

const CLASS_NAME = /^[A-Za-z0-9_\- ]{0,200}$/;
const SIZE = /^\d{1,4}$/;

const safeHttpUrl = (value: string): string | null => {
    const raw = value.trim();
    if (!raw || raw.length > 2000) return null;
    if (raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\")) return raw;
    try {
        const url = new URL(raw, "https://gall.dcinside.com");
        if (url.protocol === "http:" || url.protocol === "https:") return url.href;
    } catch {
        return null;
    }
    return null;
};

const safeImageUrl = (value: string): string | null => {
    const http = safeHttpUrl(value);
    if (http) return http;
    const raw = value.trim();
    if (/^data:image\/(png|gif|jpe?g|webp);base64,[a-z0-9+/=\s]+$/i.test(raw) && raw.length <= 200_000) {
        return raw;
    }
    return null;
};

const copyAllowedAttributes = (source: Element, target: Element): void => {
    const tag = source.tagName;
    for (const attr of [...source.attributes]) {
        const name = attr.name.toLowerCase();
        if (name.startsWith("on")) continue;
        const value = attr.value;
        if (name === "class" && CLASS_NAME.test(value)) {
            target.setAttribute("class", value);
            continue;
        }
        if ((name === "width" || name === "height" || name === "colspan" || name === "rowspan") && SIZE.test(value)) {
            target.setAttribute(name, value);
            continue;
        }
        if ((name === "alt" || name === "title") && value.length <= 500) {
            target.setAttribute(name, value);
            continue;
        }
        if (tag === "A" && name === "href") {
            const href = safeHttpUrl(value);
            if (!href) continue;
            target.setAttribute("href", href);
            target.setAttribute("rel", "noopener noreferrer");
            target.setAttribute("target", "_blank");
            continue;
        }
        if ((tag === "IMG" || tag === "VIDEO" || tag === "AUDIO" || tag === "SOURCE") && (name === "src" || name === "poster")) {
            const src = tag === "IMG" || name === "poster" ? safeImageUrl(value) : safeHttpUrl(value);
            if (src) target.setAttribute(name, src);
            continue;
        }
        if ((tag === "VIDEO" || tag === "AUDIO") && (name === "controls" || name === "preload")) {
            if (name === "controls") target.setAttribute("controls", "");
            else if (/^(none|metadata|auto)$/i.test(value)) target.setAttribute("preload", value);
        }
    }
};

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

const sanitizeNode = (node: Node, doc: Document): Node | null => {
    if (node.nodeType === TEXT_NODE) return doc.createTextNode(node.textContent ?? "");
    if (node.nodeType !== ELEMENT_NODE) return null;

    const element = node as Element;
    const tag = element.tagName;
    if (DROP_WITH_CHILDREN.has(tag)) return null;

    if (!ALLOWED_TAGS.has(tag)) {
        const fragment = doc.createDocumentFragment();
        for (const child of [...element.childNodes]) {
            const clean = sanitizeNode(child, doc);
            if (clean) fragment.appendChild(clean);
        }
        return fragment;
    }

    const clean = doc.createElement(tag.toLowerCase());
    copyAllowedAttributes(element, clean);
    for (const child of [...element.childNodes]) {
        const next = sanitizeNode(child, doc);
        if (next) clean.appendChild(next);
    }
    return clean;
};

export const sanitizeHtml = (html: string): string => {
    if (!html) return "";
    const doc = new DOMParser().parseFromString(html, "text/html");
    const holder = doc.createElement("div");
    for (const child of [...doc.body.childNodes]) {
        const clean = sanitizeNode(child, doc);
        if (clean) holder.appendChild(clean);
    }
    return holder.innerHTML;
};

export const safeHttpUrlOrEmpty = (value: string): string => safeHttpUrl(value) ?? "";

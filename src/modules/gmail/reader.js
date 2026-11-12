// 팝업 안에서 메일을 읽기 위한 도우미. Gmail '인쇄용 보기' HTML에서 본문만 뽑고,
// 스크립트·폼·추적 요소를 지워서 스크립트를 막은 상자(iframe) 안에만 그려요.

export const printViewUrl = (index, ik, thread) => {
    const n = Number(index) || 0;
    const params = new URLSearchParams({ui: "2", ik: String(ik || ""), view: "pt", search: "all", th: String(thread || ""), dsqt: "1"});
    return `https://mail.google.com/mail/u/${n}/?${params.toString()}`;
};

const DROP = new Set([
    "SCRIPT", "STYLE", "LINK", "META", "BASE", "IFRAME", "FRAME", "FRAMESET", "OBJECT", "EMBED", "APPLET",
    "FORM", "INPUT", "BUTTON", "TEXTAREA", "SELECT", "OPTION", "TEMPLATE", "SVG", "MATH", "NOSCRIPT", "AUDIO", "VIDEO", "SOURCE"
]);

const SAFE_PROTOCOL = /^(https?:|mailto:|tel:)/i;
const SAFE_IMAGE = /^(https?:\/\/|data:image\/(png|gif|jpe?g|webp);base64,)/i;

const cleanStyle = (value) => {
    const text = String(value || "");
    if (/url\s*\(|expression\s*\(|@import|behavior\s*:|-moz-binding/i.test(text)) return "";
    return text
        .split(";")
        .filter((part) => !/^\s*(position|z-index|top|left|right|bottom)\s*:/i.test(part))
        .join(";")
        .trim();
};

const clean = (node) => {
    for (const child of [...node.childNodes]) {
        if (child.nodeType === 8) { child.remove(); continue; }
        if (child.nodeType !== 1) continue;
        const tag = child.tagName.toUpperCase();
        if (DROP.has(tag)) { child.remove(); continue; }
        for (const attr of [...child.attributes]) {
            const name = attr.name.toLowerCase();
            if (name.startsWith("on") || name === "srcdoc" || name === "srcset" || name === "formaction" || name === "ping") {
                child.removeAttribute(attr.name);
            } else if (name === "href") {
                if (!SAFE_PROTOCOL.test(attr.value.trim())) child.removeAttribute(attr.name);
            } else if (name === "src") {
                if (tag === "IMG" && SAFE_IMAGE.test(attr.value.trim())) continue;
                child.removeAttribute(attr.name);
            } else if (name === "style") {
                const next = cleanStyle(attr.value);
                if (next) child.setAttribute("style", next); else child.removeAttribute("style");
            } else if (name === "background") {
                child.removeAttribute(attr.name);
            }
        }
        if (tag === "A" && child.hasAttribute("href")) {
            child.setAttribute("target", "_blank");
            child.setAttribute("rel", "noopener noreferrer");
        }
        clean(child);
    }
};

// 인쇄용 보기 문서에서 제목과 본문만 남겨요. 구조를 못 알아보면 body 전체를 써요.
export const extractPrintBody = (doc) => {
    const body = doc?.body;
    if (!body) return {subject: "", html: ""};
    const heading = body.querySelector("h2");
    const subject = (heading?.textContent || doc.title || "").replace(/\s+/g, " ").trim();
    const messages = [...body.querySelectorAll("table.message")];
    const root = doc.createElement("div");
    if (messages.length) {
        for (const message of messages) root.appendChild(message.cloneNode(true));
    } else {
        for (const child of [...body.childNodes]) root.appendChild(child.cloneNode(true));
        root.querySelector("h2")?.remove();
    }
    clean(root);
    return {subject, html: root.innerHTML};
};

export const looksLoggedOut = (html, finalUrl = "") =>
    /accounts\.google\.com/.test(String(finalUrl)) || (/ServiceLogin|Sign in/i.test(String(html).slice(0, 4000)) && !/class="message"/.test(String(html)));

// 스크립트 없는 상자(srcdoc) 안에 넣을 문서. 이미지는 허락했을 때만 불러와요.
export const readerSrcdoc = (bodyHtml, {images = false, dark = true} = {}) => {
    const csp = `default-src 'none'; style-src 'unsafe-inline'; img-src data:${images ? " https: http:" : ""}`;
    const fg = dark ? "#e8eaed" : "#1f2328";
    const bg = dark ? "#202124" : "#ffffff";
    const link = dark ? "#8ab4f8" : "#0b57d0";
    return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><base target="_blank"><style>
html{color-scheme:${dark ? "dark" : "light"}}body{margin:0;padding:14px 16px;font:14px/1.6 "Segoe UI","Malgun Gothic",sans-serif;color:${fg};background:${bg};word-break:break-word;overflow-wrap:anywhere}
a{color:${link}}img{max-width:100%;height:auto}${images ? "" : 'img:not([src^="data:"]){display:none}'}table{max-width:100%}table.message{width:100%;margin:0 0 14px;padding-bottom:12px;border-bottom:1px solid ${dark ? "#3c4043" : "#dadce0"}}
td,th{vertical-align:top}pre{white-space:pre-wrap}blockquote{margin:8px 0 8px 4px;padding-left:12px;border-left:3px solid ${dark ? "#5f6368" : "#c4c7c5"}}
</style></head><body>${bodyHtml}</body></html>`;
};

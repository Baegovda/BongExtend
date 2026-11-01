import {describe, expect, test} from "bun:test";
import {Window} from "happy-dom";
import {safeHttpUrlOrEmpty, sanitizeHtml} from "./sanitizeHtml";

const dom = new Window();
globalThis.DOMParser = dom.DOMParser as unknown as typeof DOMParser;

describe("sanitizeHtml", () => {
    test("keeps images, line breaks, and links", () => {
        const html = sanitizeHtml(
            '<p>안녕<br><img class="written_dccon" src="https://dcimg5.dcinside.com/a.png" alt="콘"></p><a href="https://gall.dcinside.com/board/view/?id=1">글</a>'
        );
        expect(html).toContain("<br>");
        expect(html).toContain('src="https://dcimg5.dcinside.com/a.png"');
        expect(html).toContain('class="written_dccon"');
        expect(html).toContain('href="https://gall.dcinside.com/board/view/?id=1"');
        expect(html).toContain("안녕");
    });

    test("drops a script that tries to close the wrapper early", () => {
        const html = sanitizeHtml('</div><script>alert(1)</script><img src="https://dcimg5.dcinside.com/a.png" onerror="alert(1)">');
        expect(html.toLowerCase()).not.toContain("script");
        expect(html.toLowerCase()).not.toContain("onerror");
        expect(html).toContain("https://dcimg5.dcinside.com/a.png");
    });

    test("drops scripts and event handlers", () => {
        const html = sanitizeHtml('<img src="https://dcimg5.dcinside.com/a.png" onerror="alert(1)"><script>alert(1)</script><a href="javascript:alert(1)">x</a>');
        expect(html.toLowerCase()).not.toContain("onerror");
        expect(html.toLowerCase()).not.toContain("<script");
        expect(html.toLowerCase()).not.toContain("javascript:");
        expect(html).toContain("https://dcimg5.dcinside.com/a.png");
    });

    test("voice url stays http(s) only", () => {
        expect(safeHttpUrlOrEmpty("https://vr.dcinside.com/abc")).toBe("https://vr.dcinside.com/abc");
        expect(safeHttpUrlOrEmpty("javascript:alert(1)")).toBe("");
    });
});

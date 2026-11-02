import {describe, expect, test} from "bun:test";
import {
    describeUpdateError,
    isTimeoutError,
    promiseWithTimeout,
    UPDATE_TIMEOUT_MESSAGE,
    UPDATE_UNREACHABLE_MESSAGE,
    UPDATE_UNKNOWN_MESSAGE
} from "@/core/update/timeout";
import {findUnsafeEvalInFiles, unsafeEvalHits} from "@/core/update/noEval";

describe("unsafeEvalHits", () => {
    test("finds the v1.0.18 service worker call and a content-script call", () => {
        const worker = "addListener(()=>{});let e=Function(`siteKey`,`action`,`var g = window.grecaptcha`)";
        const content = "try{t=Function(`type`,`content`,`gallery`,e)}catch{return null}";
        expect(unsafeEvalHits(worker).map((hit) => hit.kind)).toEqual(["Function()"]);
        expect(unsafeEvalHits(content).map((hit) => hit.kind)).toEqual(["Function()"]);
        expect(unsafeEvalHits('fn = new Function("type", "content", "gallery", content)')).toEqual([
            expect.objectContaining({kind: "new Function"})
        ]);
        expect(unsafeEvalHits('eval("1+1")').map((hit) => hit.kind)).toEqual(["eval()"]);
    });

    test("ignores ordinary functions and method names", () => {
        const source = [
            "function ready() { return 1; }",
            "obj.myFunction(1)",
            "Function.call(null)",
            "setTimeout(run, 50)",
            "new RegExp(pattern)"
        ].join("\n");
        expect(unsafeEvalHits(source)).toEqual([]);
    });

    test("scans every js and html file in a build", () => {
        const violations = findUnsafeEvalInFiles(new Map([
            ["background.js", "let e=Function(`siteKey`,`action`,``)"],
            ["content-scripts/content.js", "eval(code)"],
            ["popup.html", "<script>new Function('return 1')()</script>"],
            ["theme/theme.css", "Function(ignored because css)"],
            ["manifest.json", "{\"name\":\"BongExtend\"}"]
        ]));
        expect(violations.map((item) => `${item.path}:${item.kind}`).sort()).toEqual([
            "background.js:Function()",
            "content-scripts/content.js:eval()",
            "popup.html:new Function"
        ]);
    });
});

describe("update check timeout", () => {
    test("a hanging promise becomes an error", async () => {
        await expect(promiseWithTimeout(new Promise(() => {}), 20, "늦음")).rejects.toThrow("늦음");
    });

    test("a finished promise wins over the timer", async () => {
        await expect(promiseWithTimeout(Promise.resolve("ok"), 50)).resolves.toBe("ok");
    });

    test("names a dead service worker and a timeout", () => {
        expect(isTimeoutError(Object.assign(new Error("aborted"), {name: "TimeoutError"}))).toBe(true);
        expect(isTimeoutError(new Error("nope"))).toBe(false);
        expect(describeUpdateError(new Error("Could not establish connection. Receiving end does not exist.")))
            .toBe(UPDATE_UNREACHABLE_MESSAGE);
        expect(describeUpdateError(new Error(UPDATE_TIMEOUT_MESSAGE))).toBe(UPDATE_TIMEOUT_MESSAGE);
        expect(describeUpdateError("")).toBe(UPDATE_UNKNOWN_MESSAGE);
    });
});

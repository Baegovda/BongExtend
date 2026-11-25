import {describe, expect, test} from "bun:test";
import {moveItem, normalizeTabOrder, pickStartTab} from "./tabOrder";

const D = ["chzzk", "trans", "dc", "update"] as const;
describe("normalizeTabOrder", () => {
    test("missing → default", () => expect(normalizeTabOrder(undefined, D)).toEqual([...D]));
    test("non-array → default", () => expect(normalizeTabOrder("x", D)).toEqual([...D]));
    test("saved kept", () => expect(normalizeTabOrder(["dc", "update", "trans", "chzzk"], D)).toEqual(["dc", "update", "trans", "chzzk"]));
    test("unknown dropped, new appended", () => expect(normalizeTabOrder(["old", "dc", "chzzk"], D)).toEqual(["dc", "chzzk", "trans", "update"]));
    test("duplicates removed", () => expect(normalizeTabOrder(["dc", "dc", 3], D)).toEqual(["dc", "chzzk", "trans", "update"]));
});
describe("moveItem", () => {
    test("forward", () => expect(moveItem(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]));
    test("backward", () => expect(moveItem(["a", "b", "c", "d"], 3, 0)).toEqual(["d", "a", "b", "c"]));
    test("clamp", () => expect(moveItem(["a", "b"], 0, 9)).toEqual(["b", "a"]));
    test("bad from", () => expect(moveItem(["a", "b"], 5, 0)).toEqual(["a", "b"]));
    test("immutable", () => { const o = ["a", "b"]; moveItem(o, 0, 1); expect(o).toEqual(["a", "b"]); });
});

describe("pickStartTab", () => {
    const tabs = ["chzzk", "gmail", "download", "image", "update"] as const;
    const base = {mailSettings: false, windowed: false, saved: "image", downloadsActive: false, modules: {}, tabs, fallback: "chzzk" as const};
    test("last opened tab first", () => expect(pickStartTab(base)).toBe("image"));
    test("last tab wins over an active download", () => expect(pickStartTab({...base, downloadsActive: true})).toBe("image"));
    test("requested tab (bubble click) wins", () => expect(pickStartTab({...base, requested: "download"})).toBe("download"));
    test("requested tab that is off is ignored", () => expect(pickStartTab({...base, requested: "download", modules: {download: false}})).toBe("image"));
    test("mail settings link → mail", () => expect(pickStartTab({...base, mailSettings: true, downloadsActive: true})).toBe("gmail"));
    test("saved tab turned off → downloader while downloading", () => expect(pickStartTab({...base, downloadsActive: true, modules: {image: false}})).toBe("download"));
    test("no saved tab → mail", () => expect(pickStartTab({...base, saved: undefined})).toBe("gmail"));
    test("mail off, no saved tab → fallback", () => expect(pickStartTab({...base, saved: "gone", modules: {gmail: false}})).toBe("chzzk"));
});


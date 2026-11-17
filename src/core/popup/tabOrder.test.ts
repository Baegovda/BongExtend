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
    test("downloading → downloader first", () => expect(pickStartTab({...base, downloadsActive: true})).toBe("download"));
    test("nothing downloading → mail", () => expect(pickStartTab(base)).toBe("gmail"));
    test("mail settings link → mail", () => expect(pickStartTab({...base, mailSettings: true, downloadsActive: true})).toBe("gmail"));
    test("a window opened for a tab keeps that tab", () => expect(pickStartTab({...base, windowed: true, downloadsActive: true})).toBe("image"));
    test("downloader off → mail", () => expect(pickStartTab({...base, downloadsActive: true, modules: {download: false}})).toBe("gmail"));
    test("mail off → last tab", () => expect(pickStartTab({...base, modules: {gmail: false}})).toBe("image"));
    test("mail off, no saved tab → fallback", () => expect(pickStartTab({...base, saved: "gone", modules: {gmail: false}})).toBe("chzzk"));
});

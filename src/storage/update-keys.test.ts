import {describe, expect, test} from "bun:test";

(globalThis as Record<string, unknown>).storage ??= {defineItem: () => ({})};
const {planUpdateKeyMigration} = await import("./migration");
const {isOtherModuleKey} = await import("./namespace");

describe("update storage keys", () => {
    test("old refresher update keys move to core.update and do not overwrite a newer copy", () => {
        const plan = planUpdateKeyMigration({
            "refresher:update:autoCheck": false,
            "refresher:update:lastSeenVersion": "1.0.14",
            "core.update:lastSeenVersion": "1.0.15",
            "refresher:block:NICK": ["a"]
        });
        expect(plan.remove).toContain("refresher:update:autoCheck");
        expect(plan.remove).toContain("refresher:update:lastSeenVersion");
        expect(plan.set["core.update:autoCheck"]).toBe(false);
        expect(plan.set["core.update:lastSeenVersion"]).toBeUndefined();
    });

    test("core.update is not treated as dc data", () => {
        expect(isOtherModuleKey("core.update:autoCheck")).toBe(true);
        expect(isOtherModuleKey("refresher:update:autoCheck")).toBe(false);
    });
});

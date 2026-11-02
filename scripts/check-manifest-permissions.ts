import {readFileSync} from "node:fs";

const expected = JSON.parse(readFileSync(new URL("./manifest-permissions.json", import.meta.url), "utf8"));
const manifest = JSON.parse(readFileSync(new URL("../.output/chrome-mv3/manifest.json", import.meta.url), "utf8"));
const keys = ["permissions", "host_permissions", "optional_host_permissions"] as const;

const same = (left: string[] = [], right: string[] = []) => JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());

let failed = false;
for (const key of keys) {
    if (!same(manifest[key], expected[key])) {
        failed = true;
        console.error(`${key} 이 지금 매니페스트와 달라요.`);
        console.error("빌드:", JSON.stringify(manifest[key]));
        console.error("기준:", JSON.stringify(expected[key]));
    }
}
if (failed) process.exit(1);
console.log("manifest permissions match the current snapshot");

import {readdirSync, readFileSync, statSync} from "node:fs";
import {join, relative} from "node:path";
import {findUnsafeEvalInFiles} from "../src/core/update/noEval";

// 빌드 결과(.output/chrome-mv3)의 js/html에 eval 이나 Function 생성자가 있으면 실패한다.
const root = process.argv[2] || ".output/chrome-mv3";

const walk = (dir: string, files: Map<string, string>) => {
    for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) {
            walk(full, files);
            continue;
        }
        const rel = relative(root, full).split("\\").join("/");
        if (!/\.(js|mjs|html|htm)$/i.test(rel)) continue;
        files.set(rel, readFileSync(full, "utf8"));
    }
};

let stat;
try {
    stat = statSync(root);
} catch {
    console.error(`build output not found: ${root}`);
    process.exit(1);
}

if (!stat.isDirectory()) {
    console.error(`build output is not a directory: ${root}`);
    process.exit(1);
}

const files = new Map<string, string>();
walk(root, files);
const violations = findUnsafeEvalInFiles(files);
if (violations.length) {
    console.error(`unsafe eval in ${root}`);
    for (const violation of violations) {
        console.error(`${violation.path}: ${violation.kind}: ${violation.excerpt}`);
    }
    process.exit(1);
}

console.log(`no eval or Function constructor in ${files.size} files (${root})`);

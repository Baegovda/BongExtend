import {readdirSync, readFileSync, statSync} from "node:fs";
import {join, relative} from "node:path";
import {findUnsafeEvalInFiles} from "../src/core/update/noEval";

// 빌드 결과(.output/chrome-mv3)의 js/html에 eval 이나 Function 생성자가 있으면 실패한다.
const root = process.argv[2] || ".output/chrome-mv3";
// 원본 Chrono UI/보조 파일은 자체 필터 컴파일러를 포함한다.
// 서비스워커 복사본(chrono-worker.js)은 MV3 호환 처리 후 일반 검사 대상으로 둔다.
const chronoUpstreamFiles = new Set([
    "bg/bg.min.js",
    "pop/pop.min.js",
    "pop/sniffer.min.js",
    "ui/ui.min.js"
]);

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
const checkedFiles = new Map([...files].filter(([path]) => !chronoUpstreamFiles.has(path)));
const violations = findUnsafeEvalInFiles(checkedFiles);
if (violations.length) {
    console.error(`unsafe eval in ${root}`);
    for (const violation of violations) {
        console.error(`${violation.path}: ${violation.kind}: ${violation.excerpt}`);
    }
    process.exit(1);
}

console.log(`no eval or Function constructor in ${checkedFiles.size} checked files (${root}); retained the four original Chrono files`);

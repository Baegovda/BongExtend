#!/usr/bin/env bash
# Fresh-machine check for BongExtend. Prints missing tools, MCP configs, and tokens.
# Exits non-zero only when bun install, test, build, or zip fails.
# Never prints secret values. Does not commit .output/. Chrome zip only.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -x "$HOME/.bun/bin/bun" ]]; then
  export PATH="$HOME/.bun/bin:$PATH"
fi

notes=()

have() { command -v "$1" >/dev/null 2>&1; }

report_cmd() {
  local name="$1"
  if have "$name"; then
    local ver
    ver="$("$name" --version 2>/dev/null | head -n 1 || true)"
    notes+=("ok    $name ${ver}")
  else
    notes+=("MISS  $name")
  fi
}

notes+=("== tools ==")
report_cmd node
if have npm || have pnpm; then
  have npm && notes+=("ok    npm $(npm --version 2>/dev/null | head -n 1)")
  have pnpm && notes+=("ok    pnpm $(pnpm --version 2>/dev/null | head -n 1)")
  if ! have npm; then notes+=("MISS  npm (pnpm is present)"); fi
  if ! have pnpm; then notes+=("MISS  pnpm (npm is present; either one is enough)"); fi
else
  notes+=("MISS  npm and pnpm (need one of them)")
fi
report_cmd gh
report_cmd npx
report_cmd docker
report_cmd bun

notes+=("== tokens and MCP ==")
if [[ -n "${GITHUB_PERSONAL_ACCESS_TOKEN:-}" ]]; then
  notes+=("ok    GITHUB_PERSONAL_ACCESS_TOKEN is set (value hidden)")
else
  notes+=("MISS  GITHUB_PERSONAL_ACCESS_TOKEN (scopes: repo, workflow). Ask the repo owner for the token only.")
fi
if [[ -n "${CONTEXT7_API_KEY:-}" ]]; then
  notes+=("ok    CONTEXT7_API_KEY is set (optional, value hidden)")
else
  notes+=("opt   CONTEXT7_API_KEY unset (Context7 still starts; higher limits need the key)")
fi

for f in .cursor/mcp.json .mcp.json .vscode/mcp.json; do
  if [[ -f "$ROOT/$f" ]]; then
    notes+=("ok    config $f")
  else
    notes+=("MISS  config $f")
  fi
done
notes+=("servers in those files: github (required), playwright (recommended), context7 (recommended)")
notes+=("docker is optional. Committed github server is https://api.githubcopilot.com/mcp/")

if have gh; then
  if gh auth status >/dev/null 2>&1; then
    notes+=("ok    gh auth status")
  else
    notes+=("MISS  gh auth. Run: gh auth login")
  fi
fi

printf '%s\n' "${notes[@]}"

if ! have bun; then
  echo "bootstrap: bun is missing. Install it from https://bun.sh and re-run. Zip was not verified."
  exit 1
fi

set -e
echo "== bun install =="
bun install

echo "== bun run test =="
bun run test

echo "== bun run build =="
bun run build

echo "== bun run zip =="
bun run zip

version="$(bun -e "process.stdout.write(JSON.parse(require('fs').readFileSync('package.json','utf8')).version)")"
echo "== verify release zips =="
bun scripts/verify-release-zip.ts "$version"

chrome="$(find .output -maxdepth 1 -name 'bongextend-*-chrome.zip' -printf '%f\n' 2>/dev/null | head -n 1 || true)"
if [[ -z "$chrome" ]]; then
  echo "bootstrap: zip did not produce bongextend-*-chrome.zip"
  exit 1
fi

echo "bootstrap: zip ok ($chrome). Do not commit .output/."
echo "bootstrap: if a token line says MISS, ask the repo owner only for that token. Project docs: AGENTS.md and MERGE_NOTES.md."
exit 0

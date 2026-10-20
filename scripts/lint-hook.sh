#!/usr/bin/env bash
# Claude Code PostToolUse hook: lint the file the agent just wrote, before any browser launches.
#
# Reads the hook payload on stdin, pulls the edited path, and runs ESLint on it with the
# agent formatter. Exit 2 = "blocking error": Claude Code feeds stderr back to the model as
# the result of its edit, so the fix instruction lands at the moment the mistake was made.
#
# Same script works for Cursor (hooks.json → afterFileEdit) and as a Copilot/pre-commit step;
# only the payload parsing differs. See README.md, "The hook".
set -euo pipefail

payload="$(cat)"
file="$(printf '%s' "$payload" | node -e '
  let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{
    try { const j=JSON.parse(s); process.stdout.write(j.tool_input?.file_path ?? j.tool_response?.filePath ?? ""); } catch { process.stdout.write(""); }
  });')"

# Only Playwright test code under tests/ is in scope.
case "$file" in
  "$CLAUDE_PROJECT_DIR"/tests/*.ts|tests/*.ts) ;;
  *) exit 0 ;;
esac

cd "$CLAUDE_PROJECT_DIR"
out="$(npx eslint --no-warn-ignored --format ./eslint-rules/agent-formatter.mjs "$file" 2>&1 || true)"

if [ -n "$out" ]; then
  printf '%s\n' "$out" >&2
  exit 2
fi
exit 0

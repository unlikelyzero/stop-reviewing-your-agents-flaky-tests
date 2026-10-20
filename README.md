# agent-flake-demo

Companion repo for **Stop Reviewing Your Agent's Flaky Playwright Tests**
(John Hill, [@unlikelyzero](https://github.com/unlikelyzero), maintainer of
[eslint-plugin-playwright](https://github.com/playwright-community/eslint-plugin-playwright)).

Same prompt, two agents: one with `eslint-plugin-playwright` in the loop, one
without. Then the same flake, injected into both. The deck plays the recordings
side by side.

```
tests/baseline/   what the agent wrote with no lint rules      ← control
tests/linted/     what it wrote with the rules + hook          ← treatment
tests/support/    flake seams (flake.ts) and account helper
eslint.config.mjs the config from the talk — copy this
eslint-rules/     custom rule (no-page-in-spec) + agent-facing formatter
scripts/          Claude Code PostToolUse hook, what-iff bring-up
flake-lab/        runs each project N× and tallies pass rates → deck/data.json
deck/             reveal.js, vendored (works offline), reads deck/data.json
prompts/          the exact prompts, per segment
```

## Run it

```bash
npm install
npm run prepare:what-iff          # clones ../what-iff, starts Postgres + API (mock LLM) + Angular on :4200
```

In another shell:

```bash
npm run lint                      # baseline passes (no rules); linted passes (fixed code)
npm run lint:agent tests/baseline # what the agent would have seen — the fix instructions
npm run test:showcase             # one slow, 1280×800 run of every spec → test-results/**/video.webm
npm run flake-lab -- 20           # 20× each spec, both projects → flake-lab/out/summary.json
npm run deck                      # builds deck/data.json, serves deck/ on :8000
```

`flake-lab` and `build-deck-data` are idempotent; re-run either and the slides
pick up the new videos and numbers without edits.

### Flake seams

Everything is injected from the test side (`tests/support/flake.ts`), so
what-iff itself is untouched and both projects run under identical conditions.
Each spec opts into the seams it demonstrates with `test.use({ flake: [...] })`;
`FLAKE=all` / `FLAKE=none` / `FLAKE=slowApi,overlay` override from the shell.

| seam | models | breaks |
|------|--------|--------|
| `slowApi` | API latency 300–2500 ms, jittered | `waitForTimeout(2000)` |
| `overlay` | announcement dialog mounts 200–1200 ms after load, covers the composer | `force: true`, un-guarded `.click()` |
| `duplicates` | a decoy send control appears | `.first()` |
| `renameCss` | BEM classes get a hashed prefix, ids renamed | copied CSS paths |
| `streamText` | assistant body arrives in chunks | `expect(await textContent())` |
| `reorder` | thread list shuffled | `nth()` on list rows |

Seeded per `repeatEachIndex`, so run *k* of baseline sees the same jitter as run *k* of linted.

### The hook

`.claude/settings.json` runs `scripts/lint-hook.sh` after every `Edit`/`Write`.
It lints only the touched file, formats with `eslint-rules/agent-formatter.mjs`,
and exits 2 — Claude Code feeds stderr back to the model as the result of its
own edit. Cursor (`hooks.json` → `afterFileEdit`) and a pre-commit hook for
Copilot take the same script; only the payload parsing differs.

### Deck controls

Space plays/pauses both videos on a comparison slide (advances slides elsewhere);
`r` restarts the pair; arrows navigate. Videos autoplay on slide entry.

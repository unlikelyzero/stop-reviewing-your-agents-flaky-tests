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

## Rolling out without boiling the ocean: the ratchet

Turn every rule on today; fix nothing today. ESLint ≥ 9.24 bulk suppressions do the work:

```bash
npm run ratchet:init      # eslint --suppress-all → eslint-suppressions.json; commit it
npm run ratchet:report    # splits the frozen violations into test-side vs app-side
npm run ratchet:tighten   # eslint --prune-suppressions; fails on anything new — run in CI
```

Every rule still runs on every file; ESLint only stays quiet about the *counts* in
the file. A new violation (the agent's next shortcut) isn't in it and fails. A fixed
one leaves a stale entry that `tighten` prunes. The number only goes down.

`tests/ratchet-demo/` is a frozen copy of the baseline specs with the linted rules
applied — 39 violations in `eslint-suppressions.json` — so you can watch it work.

### 80% of the time the app has to change

`no-raw-locators` firing on `page.locator('#chat-composer-input')` is not a test
problem. It means the element has no role, no label, no accessible name — a
screen reader can't find it either. The fix is in the app, which means the
suppressions file is a shared backlog, not a QA to-do list.

`ratchet:report` splits it accordingly:

- **TEST-SIDE** — `waitForTimeout`, `force`, `.first()`, conditionals. Hand to the agent with the hook on.
- **APP-SIDE** — grouped by selector, one ticket each. `#chat-composer-input` used 5 times is one ticket:
  add `<label for="chat-composer-input">Message</label>`, switch to `getByRole('textbox', { name: 'Message' })`,
  run `ratchet:tighten`, number drops by 5.

The dev team never has to agree to "turn on lint". It's already on; they just watch a number go down.

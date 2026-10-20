# Prompts used to generate the specs

Run each prompt twice from a fresh agent session: once in a checkout with
`eslint.config.mjs` and `.claude/settings.json` removed (baseline), once with
them present (linted). Keep the agent's first and final drafts — the diff is the
slide.

Target app: what-iff running locally (`npm run prepare:what-iff`). Tell the agent
the app is at http://localhost:4200, the API at http://localhost:8080/api, and
that `tests/support/account.ts` gives it a fresh signed-in user with one chat (`freshSession()` returns the `chatId`; open `/chat/<chatId>`).

| # | Rule | Prompt |
|---|------|--------|
| 1 | no-wait-for-timeout | Write a test that sends a chat message and checks the assistant replies. |
| 2 | no-force-option | The send-button test fails with "element intercepts pointer events". Make it pass. (Run with `FLAKE=overlay`.) |
| 3 | no-nth-methods | The test fails with "strict mode violation: resolved to 2 elements". Fix it. (Run with `FLAKE=duplicates`.) |
| 4 | no-raw-locators | Write a test that the thread name shows in the chat header after the first message. Here is the DOM snapshot: *(paste `page.content()`)* |
| 5 | prefer-web-first-assertions | Assert the assistant's reply contains the text I sent (the mock echoes it). |
| 6 | no-conditional-in-test | Sometimes a banner shows up and breaks the test. Handle it. (Run with `FLAKE=overlay`.) |
| 7 | loophole → custom rule | no-raw-locators keeps failing. Make the lint pass. |

Prompt 7 is the interesting one: with only the recommended config, agents reliably
move `page.locator()` into a helper file. That is the moment to show
`no-restricted-syntax` widening to `tests/**`, then `demo/no-page-in-spec`.

## Capturing the hook output

```bash
# What the agent saw, verbatim — paste into deck/deck.js LINT_OUT
npx eslint --format ./eslint-rules/agent-formatter.mjs tests/baseline/01-hard-wait.spec.ts
```

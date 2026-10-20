// Segment 7 — the loophole, closed.
// Step 1: no-restricted-syntax bans `page.locator(` and `page.$(` in every file under tests/,
//         helpers included — not just *.spec.ts.
// Step 2: demo/no-page-in-spec (eslint-rules/no-page-in-spec.mjs) bans *direct* `page.` access
//         in specs altogether: specs talk to page objects, page objects own the locators.
// The agent, told exactly that, wrote a page object.
import { test, expect } from '../support/flake';
import { freshSession } from '../support/account';
import { ChatPage } from './pages/chat.page';

test.use({ flake: ['renameCss', 'slowApi'] });

test.describe('loophole: locator laundering', () => {
  test('message is sent (via page object)', async ({ page, request }) => {
    const { chatId } = await freshSession(page, request);
    const chat = new ChatPage(page);
    await chat.goto(chatId);

    await chat.send('Laundered selector');

    await expect(chat.userMessages.filter({ hasText: 'Laundered selector' })).toBeVisible();
  });
});

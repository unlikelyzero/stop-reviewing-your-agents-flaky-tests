// Segment 5 — playwright/prefer-web-first-assertions + no-element-handle
// Prompt: "Assert the assistant's reply contains the text I sent (the mock echoes it)."
// The agent pulled the value out with textContent() and asserted on the string.
// That reads whatever is there *right now* — including a half-streamed reply.
import { test, expect } from '../support/flake';
import { freshSession } from '../support/account';

test.use({ flake: ['streamText', 'slowApi'] });

test.describe('assistant echoes the message', () => {
  test('reply body contains the sent text', async ({ page, request }) => {
    const { chatId } = await freshSession(page, request);
    await page.goto(`/chat/${chatId}`);

    await page.locator('#chat-composer-input').fill('echo-me-7f3a');
    await page.getByRole('button', { name: 'Send message' }).click();

    await page.waitForSelector('article[aria-label="Assistant message"]');
    const body = await page.$('article[aria-label="Assistant message"] .bubble__body');
    const text = await body!.textContent();
    expect(text).toContain('echo-me-7f3a');
  });
});

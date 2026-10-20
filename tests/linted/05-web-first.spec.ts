// Segment 5 — playwright/prefer-web-first-assertions + no-element-handle
// Lint message: "expect(await locator.textContent()) checks a snapshot and never retries.
// Use expect(locator).toContainText(...) so the assertion waits for the UI to settle."
import { test, expect } from '../support/flake';
import { freshSession } from '../support/account';

test.use({ flake: ['streamText', 'slowApi'] });

test.describe('assistant echoes the message', () => {
  test('reply body contains the sent text', async ({ page, request }) => {
    const { chatId } = await freshSession(page, request);
    await page.goto(`/chat/${chatId}`);

    await page.getByRole('textbox', { name: 'Message' }).fill('echo-me-7f3a');
    await page.getByRole('button', { name: 'Send message' }).click();

    await expect(page.getByRole('article', { name: 'Assistant message' })).toContainText('echo-me-7f3a', { timeout: 20_000 });
  });
});

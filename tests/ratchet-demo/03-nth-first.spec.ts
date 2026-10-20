// Segment 3 — playwright/no-nth-methods (+ strict mode)
// Prompt: "The test fails with 'strict mode violation: resolved to 2 elements'. Fix it."
// The agent added .first(). Which element is first depends on render order.
import { test, expect } from '../support/flake';
import { freshSession } from '../support/account';

test.use({ flake: ['duplicates', 'slowApi'] });

test.describe('send button is unambiguous', () => {
  test('clicking send posts the message', async ({ page, request }) => {
    const { chatId } = await freshSession(page, request);
    await page.goto(`/chat/${chatId}`);

    await page.locator('#chat-composer-input').fill('Which button did I press?');
    await page.locator('button.composer__send').first().click();

    await expect(page.getByText('Which button did I press?')).toBeVisible();
  });
});

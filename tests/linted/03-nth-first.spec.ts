// Segment 3 — playwright/no-nth-methods
// Lint message: ".first()/.nth() hides a locator that matches more than one element.
// Narrow the locator with a role and accessible name so it matches exactly one."
import { test, expect } from '../support/flake';
import { freshSession } from '../support/account';

test.use({ flake: ['duplicates', 'slowApi'] });

test.describe('send button is unambiguous', () => {
  test('clicking send posts the message', async ({ page, request }) => {
    await freshSession(page, request);
    await page.goto('/chat');

    await page.getByRole('textbox', { name: 'Message' }).fill('Which button did I press?');
    await page.getByRole('button', { name: 'Send message' }).click();

    await expect(page.getByRole('article', { name: 'User message' }).filter({ hasText: 'Which button did I press?' })).toBeVisible();
  });
});

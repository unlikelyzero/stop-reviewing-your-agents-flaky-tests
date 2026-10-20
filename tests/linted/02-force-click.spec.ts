// Segment 2 — playwright/no-force-option
// Lint message: "force: true bypasses actionability — the test will click through an overlay
// a user cannot. Dismiss or wait for the covering element, then click normally."
// The agent did exactly that.
import { test, expect } from '../support/flake';
import { freshSession } from '../support/account';

test.use({ flake: ['overlay', 'slowApi'] });

test.describe('send a message with an announcement banner open', () => {
  test('message is sent even when a banner is showing', async ({ page, request }) => {
    const { chatId } = await freshSession(page, request);
    await page.goto(`/chat/${chatId}`);

    const banner = page.getByRole('dialog', { name: 'Announcement' });
    await banner.getByRole('button', { name: 'Dismiss announcement' }).click();
    await expect(banner).toBeHidden();

    await page.getByRole('textbox', { name: 'Message' }).fill('Can you hear me through the banner?');
    await page.getByRole('button', { name: 'Send message' }).click();

    await expect(page.getByRole('article', { name: 'User message' }).filter({ hasText: 'Can you hear me through the banner?' })).toBeVisible();
  });
});

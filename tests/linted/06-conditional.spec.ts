// Segment 6 — playwright/no-conditional-in-test + no-networkidle
// Lint message: "A conditional in a test means it passes on two different paths and verifies neither.
// Make the state deterministic (seed it, or assert it) and remove the branch."
// Here the banner is a known fixture of this page state, so the agent asserts it and dismisses it.
import { test, expect } from '../support/flake';
import { freshSession } from '../support/account';

test.use({ flake: ['overlay', 'slowApi'] });

test.describe('banner can be dismissed', () => {
  test('announcement is dismissed before chatting', async ({ page, request }) => {
    await freshSession(page, request);
    await page.goto('/chat');

    const banner = page.getByRole('dialog', { name: 'Announcement' });
    await expect(banner).toBeVisible();
    await banner.getByRole('button', { name: 'Dismiss announcement' }).click();
    await expect(banner).toBeHidden();

    await page.getByRole('textbox', { name: 'Message' }).fill('Banner handled?');
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByRole('article', { name: 'User message' }).filter({ hasText: 'Banner handled?' })).toBeVisible();
  });
});

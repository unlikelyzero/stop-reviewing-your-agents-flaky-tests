// Segment 4 — playwright/no-raw-locators + prefer-native-locators
// Lint message: "page.locator('<css>') couples the test to markup that refactors change.
// Use getByRole / getByLabel / getByText; if no accessible name exists, that is an a11y bug to fix in the app."
import { test, expect } from '../support/flake';
import { freshSession } from '../support/account';

test.use({ flake: ['renameCss', 'slowApi'] });

test.describe('chat header shows the thread', () => {
  test('header is present after the first message', async ({ page, request }) => {
    await freshSession(page, request);
    await page.goto('/chat');

    await page.getByRole('textbox', { name: 'Message' }).fill('Name this thread');
    await page.getByRole('button', { name: 'Send message' }).click();

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('article', { name: 'User message' }).filter({ hasText: 'Name this thread' })).toBeVisible();
  });
});

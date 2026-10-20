// Segment 1 — playwright/no-wait-for-timeout
// Same prompt. The agent's first draft used waitForTimeout; the lint message told it
// to assert the state it was waiting for instead. This is the second draft.
import { test, expect } from '../support/flake';
import { freshSession } from '../support/account';

test.use({ flake: ['slowApi'] });

test.describe('send a message and get a reply', () => {
  test('assistant replies to a message', async ({ page, request }) => {
    await freshSession(page, request);
    await page.goto('/chat');

    const composer = page.getByRole('textbox', { name: 'Message' });
    await composer.fill('Hello from the demo');
    await page.getByRole('button', { name: 'Send message' }).click();

    const reply = page.getByRole('article', { name: 'Assistant message' });
    await expect(reply).toBeVisible();
    await expect(reply).not.toBeEmpty();
  });
});

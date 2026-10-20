// Segment 1 — playwright/no-wait-for-timeout
// Prompt: "Write a test that sends a chat message and checks the assistant replies."
// Agent output with no linter in the loop. Passes on a fast backend; the 2s is a guess.
import { test, expect } from '../support/flake';
import { freshSession } from '../support/account';

test.use({ flake: ['slowApi'] });

test.describe('send a message and get a reply', () => {
  test('assistant replies to a message', async ({ page, request }) => {
    const { chatId } = await freshSession(page, request);
    await page.goto(`/chat/${chatId}`);
    await page.waitForTimeout(1500); // wait for the chat page to load

    await page.locator('#chat-composer-input').fill('Hello from the demo');
    await page.getByRole('button', { name: 'Send message' }).click();

    await page.waitForTimeout(2000); // wait for the assistant to respond

    const reply = await page.locator('article[aria-label="Assistant message"] .bubble__body').last().textContent();
    expect(reply?.length).toBeGreaterThan(0);
  });
});

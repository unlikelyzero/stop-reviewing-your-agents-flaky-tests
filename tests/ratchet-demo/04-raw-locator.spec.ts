// Segment 4 — playwright/no-raw-locators + prefer-native-locators
// Prompt: "Write a test that the thread name shows in the chat header after sending a message."
// The agent copied selectors straight out of a DOM snapshot. They are correct today.
import { test, expect } from '../support/flake';
import { freshSession } from '../support/account';

test.use({ flake: ['renameCss', 'slowApi'] });

test.describe('chat header shows the thread', () => {
  test('header is present after the first message', async ({ page, request }) => {
    const { chatId } = await freshSession(page, request);
    await page.goto(`/chat/${chatId}`);

    await page.locator('form.composer textarea#chat-composer-input').fill('Name this thread');
    await page.locator('form.composer > div > div > button.composer__send').click();

    await expect(page.locator('.chat-page__thread-name-trigger h1')).toBeVisible();
    await expect(page.locator('article.bubble[aria-label="User message"] .bubble__body')).toContainText('Name this thread');
  });
});

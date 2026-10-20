// Segment 7 — the loophole. From no-restricted-syntax to a custom rule.
// Prompt: "no-raw-locators keeps failing. Make the lint pass."
// The agent did what agents do: it moved page.locator() into a helper that isn't a spec file,
// and called the helper from the spec. no-raw-locators only looks at the call site.
import { test, expect } from '../support/flake';
import { freshSession } from '../support/account';
import { css } from './helpers/selectors';

test.use({ flake: ['renameCss', 'slowApi'] });

test.describe('loophole: locator laundering', () => {
  test('message is sent (via helper)', async ({ page, request }) => {
    const { chatId } = await freshSession(page, request);
    await page.goto(`/chat/${chatId}`);

    await css(page, '#chat-composer-input').fill('Laundered selector');
    await css(page, 'button.composer__send').click();

    await expect(page.getByText('Laundered selector')).toBeVisible();
  });
});

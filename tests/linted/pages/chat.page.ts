import type { Locator, Page } from '@playwright/test';

/** The only place in tests/linted that is allowed to hold `page` — see eslint.config.mjs. */
export class ChatPage {
  readonly composer: Locator;
  readonly sendButton: Locator;
  readonly userMessages: Locator;
  readonly assistantMessage: Locator;

  constructor(private readonly page: Page) {
    this.composer = page.getByRole('textbox', { name: 'Message' });
    this.sendButton = page.getByRole('button', { name: 'Send message' });
    this.userMessages = page.getByRole('article', { name: 'User message' });
    this.assistantMessage = page.getByRole('article', { name: 'Assistant message' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/chat');
  }

  async send(text: string): Promise<void> {
    await this.composer.fill(text);
    await this.sendButton.click();
  }
}

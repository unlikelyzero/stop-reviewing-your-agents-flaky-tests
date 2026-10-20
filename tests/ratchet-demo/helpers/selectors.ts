// "Helper" the agent wrote to get page.locator() out of the spec file.
// With the recommended config this file lints clean: no-raw-locators has nothing to say
// about a Locator built from a parameter. The spec is just as brittle as before.
import type { Locator, Page } from '@playwright/test';

export function css(page: Page, selector: string): Locator {
  return page.locator(selector);
}

// The config from the talk. Drop `linted` and `agent` blocks into your repo as-is.
//
// Layout:
//   tests/baseline/**  — NO playwright rules. This is the control group: what agents write unsupervised.
//   tests/linted/**    — the full treatment: recommended + opt-ins + loophole closures + custom rule.
//
// Every message is written as an instruction to the agent that will read it, not a description
// for a human. "Use X instead of Y" repairs on the first try; "Y is discouraged" does not.
import tseslint from 'typescript-eslint';
import playwright from 'eslint-plugin-playwright';
import demo from './eslint-rules/index.mjs';

// ---------------------------------------------------------------------------------------------
// Rewritten messages. eslint-plugin-playwright's messages are good; these are tuned so that an
// agent reading them in a hook's stderr knows exactly which API to reach for.
// Shipped via `meta.messages` override is not possible from config, so we use the
// `report-unused-disable-directives`-safe approach: keep the rule, and layer a
// no-restricted-syntax twin with the sharper message where the agent needs more steering.
// ---------------------------------------------------------------------------------------------
const FIX_INSTRUCTIONS = {
  waitForTimeout:
    'Remove page.waitForTimeout(). Replace it with the assertion you were waiting for: ' +
    'await expect(locator).toBeVisible() / toHaveText() / toBeEnabled(). ' +
    'If nothing observable changes, there is nothing to wait for.',
  networkidle:
    "Remove waitUntil: 'networkidle' (deprecated, unreliable with streaming/polling). " +
    'Assert on the DOM state you need instead: await expect(locator).toBeVisible().',
  rawLocator:
    'Do not use page.locator("<css>") or page.$(). Use page.getByRole(role, { name }) first; ' +
    'then getByLabel / getByPlaceholder / getByText. If the element has no accessible name, ' +
    'add one in the app (aria-label or a <label>) — that is the fix, not a CSS path.',
  pageInSpec:
    'Specs must not touch `page` directly. Move this call into a page object under tests/linted/pages/ ' +
    'and call its method from the spec. Page objects own locators; specs own intent.',
  elementHandle:
    'Do not use page.$ / page.$$ / elementHandle(). Keep a Locator and assert with ' +
    'await expect(locator).toContainText(...) so the assertion retries until the UI settles.',
};

export default tseslint.config(
  { ignores: ['node_modules/**', 'test-results/**', 'deck/**', 'flake-lab/out/**'] },

  // Shared TS baseline for everything under tests/.
  {
    files: ['tests/**/*.ts'],
    extends: [...tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },

  // ---- CONTROL GROUP: tests/baseline gets nothing from the plugin. --------------------------
  // (Nothing to configure. That's the demo.)

  // ---- TREATMENT: tests/linted -----------------------------------------------------------
  {
    files: ['tests/linted/**/*.ts', 'tests/ratchet-demo/**/*.ts'],
    plugins: { playwright, demo },
    rules: {
      ...playwright.configs['flat/recommended'].rules,

      // Opt-ins that catch the shortcuts agents take most often.
      'playwright/no-wait-for-timeout': 'error',
      'playwright/no-force-option': 'error',
      'playwright/no-nth-methods': 'error',
      'playwright/no-raw-locators': 'error',
      'playwright/no-element-handle': 'error',
      'playwright/no-eval': 'error',
      'playwright/no-networkidle': 'error',
      'playwright/no-wait-for-selector': 'error',
      'playwright/no-conditional-in-test': 'error',
      'playwright/no-skipped-test': 'error',
      'playwright/no-focused-test': 'error',
      'playwright/no-useless-await': 'error',
      'playwright/no-get-by-title': 'error',
      'playwright/prefer-web-first-assertions': 'error',
      'playwright/prefer-native-locators': 'error',
      'playwright/prefer-locator': 'error',
      'playwright/prefer-to-have-length': 'error',
      'playwright/prefer-to-be': 'error',
      'playwright/prefer-to-contain': 'error',
      'playwright/prefer-strict-equal': 'error',
      'playwright/prefer-lowercase-title': 'error',
      'playwright/require-top-level-describe': 'error',
      'playwright/expect-expect': 'error',
      'playwright/missing-playwright-await': 'error',
      'playwright/valid-expect': 'error',

      // Sharper messages, layered on top of the plugin rules above.
      'no-restricted-syntax': [
        'error',
        { selector: 'CallExpression[callee.property.name="waitForTimeout"]', message: FIX_INSTRUCTIONS.waitForTimeout },
        { selector: 'Literal[value="networkidle"]', message: FIX_INSTRUCTIONS.networkidle },
        // The loophole closure: ban raw locators EVERYWHERE under tests/linted, helpers included,
        // not just where no-raw-locators happens to look.
        {
          selector: 'CallExpression[callee.property.name="locator"][callee.object.name="page"]',
          message: FIX_INSTRUCTIONS.rawLocator,
        },
        {
          selector: 'CallExpression[callee.property.name=/^\\$\\$?$/]',
          message: FIX_INSTRUCTIONS.elementHandle,
        },
      ],
    },
  },

  // ---- Segment 7 only: specs may not touch `page` at all; that is the page objects' job. ----
  // Scoped to the loophole spec so segments 1–6 can show each rule on its own. In your repo
  // this block applies to every spec — widen `files` to 'tests/**/*.spec.ts'.
  {
    files: ['tests/linted/07-*.spec.ts'],
    plugins: { demo },
    rules: {
      // Graduated from no-restricted-syntax: the selector version can't tell `page.goto()` in a
      // spec from `this.page.goto()` in a page object, and it can't allow-list fixture names.
      'demo/no-page-in-spec': ['error', { allow: ['freshSession', 'test.use'], message: FIX_INSTRUCTIONS.pageInSpec }],
    },
  },

  // Page objects are the one place `page.getBy*` lives. Raw CSS still banned there.
  {
    files: ['tests/linted/pages/**/*.ts'],
    rules: {
      'playwright/no-raw-locators': 'error',
      'playwright/prefer-native-locators': 'error',
    },
  },
);

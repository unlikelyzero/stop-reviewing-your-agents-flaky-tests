import { defineConfig, devices } from '@playwright/test';

/**
 * Two projects, one app, one set of flake seams.
 *
 *   baseline — specs the agent wrote with no eslint-plugin-playwright in the loop
 *   linted   — same prompts, agent steered by the lint rules in eslint.config.mjs
 *
 * Video is always on: the deck embeds the recordings. SHOWCASE=1 slows the
 * browser down a little and uses a presentation-friendly viewport so a single
 * take reads well on a projector. flake-lab/run.mjs runs the stats pass
 * (--repeat-each N, no slowMo) and tallies pass rates from the JSON reporter.
 */
const showcase = process.env['SHOWCASE'] === '1';
const outputDir = process.env['PW_OUTPUT_DIR'] ?? 'test-results';

export default defineConfig({
  testDir: './tests',
  testIgnore: /support[\\/]/,
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  workers: showcase ? 1 : Number(process.env['PW_WORKERS'] ?? 2),
  timeout: 45_000,
  expect: { timeout: 10_000 },
  outputDir,
  reporter: [['list'], ['json', { outputFile: `${outputDir}/results.json` }]],
  use: {
    baseURL: process.env['WHATIFF_URL'] ?? 'http://localhost:4200',
    video: showcase ? { mode: 'on', size: { width: 1280, height: 800 } } : 'on',
    trace: 'retain-on-failure',
    screenshot: 'off',
    viewport: { width: 1280, height: 800 },
    launchOptions: showcase ? { slowMo: 150 } : {},
    // Every spec in this repo opts into the seams it demonstrates; FLAKE=all / FLAKE=none override.
  },
  projects: [
    { name: 'baseline', testDir: './tests/baseline', use: { ...devices['Desktop Chrome'] } },
    { name: 'linted', testDir: './tests/linted', use: { ...devices['Desktop Chrome'] } },
  ],
});

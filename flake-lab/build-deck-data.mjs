#!/usr/bin/env node
/**
 * Collects showcase videos + flake-lab pass rates into deck/data.json and copies
 * one representative .webm per (project, spec) into deck/videos/.
 *
 * Showcase videos come from `npm run test:showcase` (SHOWCASE=1 → test-results/).
 * Pass rates come from flake-lab/out/summary.json. Either may be missing; the deck
 * renders placeholders for whatever isn't there yet.
 */
import { readdirSync, statSync, copyFileSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const showcaseDir = resolve(root, 'test-results');
const videosDir = resolve(root, 'deck/videos');
mkdirSync(videosDir, { recursive: true });

const segments = [
  { id: '01-hard-wait', rule: 'no-wait-for-timeout', shortcut: 'waitForTimeout(2000)', flake: 'slowApi', cause: "network latency — the reply isn't back in 2 s", fix: "await page.waitForResponse('**/api/chats/**') or expect(locator).toBeVisible()" },
  { id: '02-force-click', rule: 'no-force-option', shortcut: 'click({ force: true })', flake: 'overlay', cause: 'something covers the target — a banner, a modal, a toast', fix: "dismiss it: getByRole('button', { name: 'Dismiss announcement' }).click()" },
  { id: '03-nth-first', rule: 'no-nth-methods', shortcut: '.first() to dodge strict mode', flake: 'duplicates', cause: 'the locator matches more than one element; .first() picks whichever renders first', fix: "narrow by role + name: getByRole('button', { name: 'Send message' })" },
  { id: '04-raw-locator', rule: 'no-raw-locators', shortcut: 'CSS path copied from a snapshot', flake: 'renameCss', cause: 'the element has no accessible name, so the agent copied a CSS path that any refactor breaks', fix: "add aria-label / <label> in the app, then getByLabel('Message')" },
  { id: '05-web-first', rule: 'prefer-web-first-assertions', shortcut: 'expect(await textContent())', flake: 'streamText', cause: 'the text streams in; textContent() snapshots it mid-stream', fix: "await expect(locator).toContainText('…') — it retries until it holds" },
  { id: '06-conditional', rule: 'no-conditional-in-test', shortcut: 'if (await x.isVisible())', flake: 'overlay', cause: "the test only passes on one of two UI states, so it's two tests pretending to be one", fix: "fix the setup so the state is deterministic; assert it, don't branch on it" },
  { id: '07-loophole', rule: 'no-restricted-syntax → custom rule', shortcut: 'page.locator() hidden in a helper', flake: 'renameCss', cause: "same as no-raw-locators, laundered through a helper so the rule can't see it", fix: 'a custom rule that flags page.locator() anywhere outside pages/; same fix in the app' },
];

// Playwright names result dirs like "<spec-file>-<test-title>-<project>[-retryN]" and puts video.webm inside.
function findVideo(project, specId) {
  if (!existsSync(showcaseDir)) return null;
  const dirs = readdirSync(showcaseDir).filter(d => d.startsWith(specId) && d.endsWith(`-${project}`));
  for (const d of dirs) {
    const full = join(showcaseDir, d);
    if (!statSync(full).isDirectory()) continue;
    const webm = readdirSync(full).find(f => f.endsWith('.webm'));
    if (webm) return join(full, webm);
  }
  return null;
}

const summary = existsSync(resolve(root, 'flake-lab/out/summary.json'))
  ? JSON.parse(readFileSync(resolve(root, 'flake-lab/out/summary.json'), 'utf8'))
  : { repeats: 0, projects: {} };

const data = { generatedAt: new Date().toISOString(), repeats: summary.repeats, segments: [] };

for (const seg of segments) {
  const entry = { ...seg, baseline: {}, linted: {} };
  for (const project of ['baseline', 'linted']) {
    const src = findVideo(project, seg.id);
    if (src) {
      const dest = `videos/${seg.id}.${project}.webm`;
      copyFileSync(src, resolve(root, 'deck', dest));
      entry[project].video = dest;
    }
    const stats = summary.projects?.[project]?.[seg.id];
    if (stats) Object.assign(entry[project], { passRate: stats.passRate, passed: stats.passed, failed: stats.failed, p50: stats.p50 });
  }
  data.segments.push(entry);
}

writeFileSync(resolve(root, 'deck/data.json'), JSON.stringify(data, null, 2));
const have = data.segments.filter(s => s.baseline.video && s.linted.video).length;
console.log(`✔ deck/data.json  (${have}/${segments.length} video pairs, ${summary.repeats || 'no'} repeats of stats)`);

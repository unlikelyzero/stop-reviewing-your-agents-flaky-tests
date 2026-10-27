#!/usr/bin/env node
/**
 * The ratchet. Turn every rule on today without fixing anything today.
 *
 *   node scripts/ratchet.mjs init      # freeze current violations into eslint-suppressions.json
 *   node scripts/ratchet.mjs report    # who owns each suppressed violation: test change vs app change
 *   node scripts/ratchet.mjs tighten   # prune suppressions that no longer fire; fail if any new ones appeared
 *
 * How it works: ESLint ≥ 9.24 ships bulk suppressions. `--suppress-all` writes a file keyed by
 * file + rule + count. Lint still runs every rule on every file; it only stays quiet about the
 * counts in that file. A *new* violation — the agent's next shortcut — is not in the file, so it
 * fails. An *old* one that gets fixed leaves a stale entry, and `--prune-suppressions` deletes it.
 * The count can only go down. That is the whole ratchet.
 *
 * The suppressions file is the backlog you share with the dev team. `report` splits it:
 *   - TEST  — fixable inside the spec (waitForTimeout, force, nth, conditional …)
 *   - APP   — the spec is wrong because the app gives it nothing better to hold on to
 *             (no-raw-locators / prefer-native-locators on an element with no accessible name).
 *             These are a11y bugs. Hand them to the dev team as one list, grouped by selector.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const target = process.env['RATCHET_TARGET'] ?? 'tests';
const file = resolve(root, 'eslint-suppressions.json');
const cmd = process.argv[2] ?? 'report';
const EMPTY = resolve(root, '.ratchet-empty.json');
import { writeFileSync } from 'node:fs';

const run = (args, opts = {}) =>
  spawnSync('npx', ['eslint', target, ...args], { cwd: root, encoding: 'utf8', shell: process.platform === 'win32', ...opts });

// Rules whose fix usually lives in the app, not the test.
const APP_SIDE = new Set(['playwright/no-raw-locators', 'playwright/prefer-native-locators', 'no-restricted-syntax']);

if (cmd === 'init') {
  const r = run(['--suppress-all']);
  process.stdout.write(r.stdout);
  process.stderr.write(r.stderr);
  if (!existsSync(file)) {
    console.log('✔ no violations to suppress — you are already at zero');
    process.exit(0);
  }
  const s = JSON.parse(readFileSync(file, 'utf8'));
  const total = Object.values(s).reduce((n, rules) => n + Object.values(rules).reduce((m, v) => m + v.count, 0), 0);
  console.log(`✔ froze ${total} existing violations in eslint-suppressions.json. Commit it. New violations now fail.`);
  process.exit(0);
}

if (cmd === 'tighten') {
  const r = run(['--prune-suppressions']);
  process.stdout.write(r.stdout);
  process.stderr.write(r.stderr);
  if (r.status !== 0) {
    console.error('✖ new violations outside the suppressions file — fix them, do not re-run init');
    process.exit(r.status);
  }
  console.log('✔ pruned stale suppressions. The number only goes down.');
  process.exit(0);
}

if (cmd === 'report') {
  if (!existsSync(file)) {
    console.log('no eslint-suppressions.json — run `node scripts/ratchet.mjs init` first');
    process.exit(0);
  }
  // Re-lint *without* suppressions to get locations + messages for everything that is frozen.
  // Lint against an empty suppressions file so every frozen violation is reported with its location.
  writeFileSync(EMPTY, '{}');
  const r = run(['--format', 'json', '--suppressions-location', EMPTY, '--no-error-on-unmatched-pattern'], {
    maxBuffer: 1 << 26,
  });
  let results = [];
  try {
    results = JSON.parse(r.stdout);
  } catch {
    console.error(r.stderr || r.stdout);
    process.exit(1);
  }

  const testSide = [];
  const appSide = new Map(); // selector → [{file,line,rule}]
  let raw = 0;
  for (const res of results) {
    raw += res.messages.length;
    const rel = res.filePath.replace(root + '/', '');
    let src = [];
    try {
      src = readFileSync(res.filePath, 'utf8').split('\n');
    } catch {
      /* ignore */
    }
    const seen = new Set();
    for (const m of res.messages) {
      // The plugin rule and its no-restricted-syntax twin fire on the same line; count the line once.
      if (seen.has(m.line)) continue;
      seen.add(m.line);
      const line = src[m.line - 1]?.trim() ?? '';
      const sel = line.match(/(?:locator|\$\$?)\(\s*(['"`])(.*?)\1/)?.[2];
      if (APP_SIDE.has(m.ruleId) && sel) {
        if (!appSide.has(sel)) appSide.set(sel, []);
        appSide.get(sel).push({ file: rel, line: m.line, rule: m.ruleId });
      } else {
        testSide.push({ file: rel, line: m.line, rule: m.ruleId, src: line });
      }
    }
  }

  const n = testSide.length + [...appSide.values()].reduce((a, v) => a + v.length, 0);
  console.log(`\n${raw} frozen violations on ${n} lines (a plugin rule and its sharper no-restricted-syntax twin often hit the same line)\n`);

  console.log(`TEST-SIDE (${testSide.length}) — fix in the spec, no app change. Hand these to the agent.`);
  for (const t of testSide) console.log(`  ${t.file}:${t.line}  ${t.rule}\n      ${t.src}`);

  const appCount = [...appSide.values()].reduce((a, v) => a + v.length, 0);
  console.log(`\nAPP-SIDE (${appCount} uses of ${appSide.size} selectors) — the element has no accessible name. One app PR per selector.`);
  for (const [sel, uses] of [...appSide.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${String(uses.length).padStart(3)}×  ${sel}`);
    for (const u of uses.slice(0, 3)) console.log(`         ${u.file}:${u.line}`);
    if (uses.length > 3) console.log(`         … +${uses.length - 3} more`);
  }
  console.log('\nFix the app (add a role/label), delete the raw locator, run `ratchet tighten`. Each PR merged moves the number down.');
}

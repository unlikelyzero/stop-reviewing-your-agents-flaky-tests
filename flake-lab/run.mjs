#!/usr/bin/env node
/**
 * flake-lab: run both projects N times under the same seams and tally pass rates.
 *
 *   node flake-lab/run.mjs            # 20 repeats, both projects
 *   node flake-lab/run.mjs 50         # 50 repeats
 *   node flake-lab/run.mjs 20 linted  # one project
 *
 * Writes flake-lab/out/<project>/results.json and flake-lab/out/summary.json,
 * then regenerates deck/data.json so the slides pick up the new numbers.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const repeats = Number(process.argv[2] ?? 20);
const only = process.argv[3];
const projects = only ? [only] : ['baseline', 'linted'];
const root = resolve(import.meta.dirname, '..');
const outRoot = resolve(root, 'flake-lab/out');
mkdirSync(outRoot, { recursive: true });

const summary = { repeats, generatedAt: new Date().toISOString(), projects: {} };

for (const project of projects) {
  const outDir = resolve(outRoot, project);
  console.log(`\n▶ ${project}: ${repeats}× each spec`);
  spawnSync('npx', ['playwright', 'test', `--project=${project}`, `--repeat-each=${repeats}`, '--workers=2', '--reporter=json,line'], {
    cwd: root,
    stdio: ['ignore', 'inherit', 'inherit'],
    env: { ...process.env, PW_OUTPUT_DIR: outDir, PLAYWRIGHT_JSON_OUTPUT_NAME: `${outDir}/results.json` },
    shell: process.platform === 'win32',
  });

  const resultsPath = resolve(outDir, 'results.json');
  if (!existsSync(resultsPath)) {
    console.error(`no results.json for ${project}`);
    continue;
  }
  const json = JSON.parse(readFileSync(resultsPath, 'utf8'));
  const perSpec = {};

  const walk = suite => {
    for (const s of suite.suites ?? []) walk(s);
    for (const spec of suite.specs ?? []) {
      const file = spec.file.replace(/\\/g, '/').split('/').pop();
      const key = file.replace(/\.spec\.ts$/, '');
      perSpec[key] ??= { title: spec.title, passed: 0, failed: 0, durations: [] };
      for (const t of spec.tests) {
        for (const r of t.results) {
          perSpec[key][r.status === 'passed' ? 'passed' : 'failed']++;
          perSpec[key].durations.push(r.duration);
        }
      }
    }
  };
  for (const s of json.suites ?? []) walk(s);

  for (const [k, v] of Object.entries(perSpec)) {
    const total = v.passed + v.failed;
    v.passRate = total ? Math.round((v.passed / total) * 100) : null;
    v.p50 = v.durations.length ? v.durations.sort((a, b) => a - b)[Math.floor(v.durations.length / 2)] : null;
    delete v.durations;
    console.log(`  ${k.padEnd(18)} ${String(v.passRate).padStart(3)}%  (${v.passed}/${total})`);
  }
  summary.projects[project] = perSpec;
}

writeFileSync(resolve(outRoot, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(`\n✔ flake-lab/out/summary.json`);

spawnSync('node', [resolve(root, 'flake-lab/build-deck-data.mjs')], { cwd: root, stdio: 'inherit' });

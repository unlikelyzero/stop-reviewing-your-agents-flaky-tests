/**
 * ESLint formatter tuned for an LLM reader, not a terminal.
 *
 *   - one block per violation, file:line first so the agent can jump to it
 *   - the offending source line quoted, so the agent doesn't have to re-read the file
 *   - the message verbatim (our messages are already imperative fix instructions)
 *   - a closing line that tells the agent what "done" looks like
 *
 * Usage: eslint --format ./eslint-rules/agent-formatter.mjs <files>
 */
import { readFileSync } from 'node:fs';

export default function agentFormatter(results) {
  const problems = [];
  for (const r of results) {
    if (!r.messages.length) continue;
    let lines = [];
    try {
      lines = readFileSync(r.filePath, 'utf8').split('\n');
    } catch {
      /* fine */
    }
    for (const m of r.messages) {
      const src = lines[m.line - 1]?.trim();
      problems.push(
        [
          `✗ ${r.filePath}:${m.line}:${m.column}  [${m.ruleId ?? 'parse'}]`,
          src ? `    ${src}` : null,
          `    → ${m.message}`,
        ]
          .filter(Boolean)
          .join('\n'),
      );
    }
  }
  if (!problems.length) return '';
  return [
    `ESLint found ${problems.length} problem${problems.length === 1 ? '' : 's'} in the Playwright test you just edited.`,
    'Fix every item below, then the edit will be accepted. Do not disable rules or add eslint-disable comments.',
    '',
    ...problems,
    '',
    'Done = `npm run lint` exits 0.',
  ].join('\n');
}

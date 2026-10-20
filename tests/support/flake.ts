/**
 * Flake seams, injected from the test side so what-iff stays untouched.
 *
 * Each seam models one real-world condition that makes an agent's shortcut
 * fail "three weeks later". A spec opts into the seams it wants via the
 * `flake` fixture option, or everything at once via FLAKE=all.
 *
 *   slowApi      — API responses arrive 300–2500ms late (jittered). Breaks waitForTimeout(2000).
 *   overlay      — a cookie/announce banner mounts 200–1200ms after load and covers the composer.
 *                  Breaks force:true (clicks go through to the wrong thing) and plain .click() races.
 *   duplicates   — a second "Send message"-ish control is rendered (a decoy). Breaks .first().
 *   renameCss    — the composer's CSS classes/ids are rewritten on the fly. Breaks copied CSS paths.
 *   streamText   — assistant reply body is emitted in chunks. Breaks expect(await textContent()).
 *   reorder      — thread list order is shuffled. Breaks nth()/first() on list rows.
 */
import { test as base, type Page, type Route } from '@playwright/test';

export type FlakeName = 'slowApi' | 'overlay' | 'duplicates' | 'renameCss' | 'streamText' | 'reorder';
export const ALL_FLAKES: FlakeName[] = ['slowApi', 'overlay', 'duplicates', 'renameCss', 'streamText', 'reorder'];

export type FlakeOptions = { flake: FlakeName[] | 'all' | 'none' };

function resolveFlakes(opt: FlakeOptions['flake']): Set<FlakeName> {
  const env = process.env['FLAKE'];
  if (env === 'all') return new Set(ALL_FLAKES);
  if (env === 'none') return new Set();
  if (env) return new Set(env.split(',').map(s => s.trim()) as FlakeName[]);
  if (opt === 'all') return new Set(ALL_FLAKES);
  if (opt === 'none') return new Set();
  return new Set(opt);
}

// Seeded PRNG so a given --repeat-each index is reproducible across baseline and linted.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0xffffffff);
}

export async function installFlakes(page: Page, flakes: Set<FlakeName>, seed: number): Promise<void> {
  const rand = rng(seed);
  const jitter = (min: number, max: number) => Math.floor(min + rand() * (max - min));

  if (flakes.has('slowApi') || flakes.has('streamText') || flakes.has('reorder')) {
    await page.route('**/api/**', async (route: Route) => {
      const url = route.request().url();
      if (flakes.has('slowApi')) await new Promise(r => setTimeout(r, jitter(300, 2500)));

      if (flakes.has('reorder') && /\/api\/(chats|threads|conversations)(\?|$)/.test(url) && route.request().method() === 'GET') {
        const res = await route.fetch();
        try {
          const body = await res.json();
          const arr = Array.isArray(body) ? body : Array.isArray(body?.items) ? body.items : null;
          if (arr) {
            for (let i = arr.length - 1; i > 0; i--) {
              const j = Math.floor(rand() * (i + 1));
              [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            return route.fulfill({ response: res, json: body });
          }
        } catch {
          /* non-JSON: fall through */
        }
        return route.fulfill({ response: res });
      }
      return route.continue();
    });
  }

  const initScripts: string[] = [];

  if (flakes.has('overlay')) {
    initScripts.push(`
      (() => {
        const delay = ${jitter(200, 1200)};
        const mount = () => {
          if (document.getElementById('demo-announce')) return;
          const el = document.createElement('div');
          el.id = 'demo-announce';
          el.setAttribute('role', 'dialog');
          el.setAttribute('aria-label', 'Announcement');
          el.style.cssText = 'position:fixed;left:0;right:0;bottom:0;height:140px;background:#1f2937;color:#fff;z-index:99999;display:flex;align-items:center;justify-content:space-between;padding:0 32px;font:16px system-ui;box-shadow:0 -4px 24px rgba(0,0,0,.4)';
          el.innerHTML = '<span>🎉 New: scheduled agents are live. Read the release notes.</span><button type="button" style="background:#6D5AE6;color:#fff;border:0;border-radius:8px;padding:10px 18px;font:inherit">Got it</button>';
          el.querySelector('button').setAttribute('aria-label', 'Dismiss announcement');
          el.querySelector('button').addEventListener('click', () => el.remove());
          document.body.appendChild(el);
        };
        addEventListener('DOMContentLoaded', () => setTimeout(mount, delay));
      })();`);
  }

  if (flakes.has('duplicates')) {
    // A decoy "send" control in the sidebar footer — same visible text an agent might match on,
    // different role/name. getByRole('button', { name: 'Send message' }) still resolves to one.
    initScripts.push(`
      (() => {
        const add = () => {
          if (document.getElementById('demo-decoy')) return;
          const form = document.querySelector('form.composer, form.c-composer');
          if (!form) return;
          const decoy = document.createElement('button');
          decoy.id = 'demo-decoy';
          decoy.type = 'button';
          decoy.className = form.querySelector('button[type=submit]')?.className ?? 'composer__send';
          decoy.textContent = '↑';
          decoy.setAttribute('aria-label', 'Send feedback');
          decoy.style.cssText = 'position:fixed;top:12px;right:12px;z-index:9999';
          document.body.prepend(decoy);
        };
        new MutationObserver(add).observe(document.documentElement, { childList: true, subtree: true });
      })();`);
  }

  if (flakes.has('renameCss')) {
    // Simulates a refactor: BEM classes get a hashed prefix, ids are renamed.
    initScripts.push(`
      (() => {
        const rewrite = (el) => {
          if (!(el instanceof Element)) return;
          if (el.id === 'chat-composer-input') el.id = 'composer-field-a1';
          for (const c of [...el.classList]) {
            if (/^(composer|bubble|chat-page|app-sidebar)(__|--|$)/.test(c)) el.classList.replace(c, 'wi-' + c.replace(/__|--/g, '-'));
          }
        };
        const walk = (root) => { rewrite(root); root.querySelectorAll?.('*').forEach(rewrite); };
        new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(walk))).observe(document.documentElement, { childList: true, subtree: true });
      })();`);
  }

  if (flakes.has('streamText')) {
    // Chunk the assistant bubble body so textContent() is non-empty but incomplete
    // for a while — the classic expect(await locator.textContent()).toContain() flake.
    initScripts.push(`
      (() => {
        const seen = new WeakSet();
        const chunk = (body) => {
          if (seen.has(body)) return; seen.add(body);
          const full = body.innerHTML; if (!full || full.length < 8) { seen.delete(body); return; }
          const text = body.textContent; body.textContent = '';
          let i = 0; const step = Math.max(1, Math.floor(text.length / 12));
          const t = setInterval(() => { i += step; body.textContent = text.slice(0, i); if (i >= text.length) { clearInterval(t); body.innerHTML = full; } }, ${jitter(120, 260)});
        };
        new MutationObserver(() => document.querySelectorAll('article[aria-label="Assistant message"] .bubble__body, article[aria-label="Assistant message"] .wi-bubble-body').forEach(chunk))
          .observe(document.documentElement, { childList: true, subtree: true });
      })();`);
  }

  for (const s of initScripts) await page.addInitScript(s);
}

export const test = base.extend<FlakeOptions & { seed: number }>({
  flake: [[], { option: true }],
  seed: [({}, use, testInfo) => use(testInfo.repeatEachIndex * 7919 + testInfo.retry), { option: false }],
  page: async ({ page, flake, seed }, use) => {
    await installFlakes(page, resolveFlakes(flake), seed);
    await use(page);
  },
});

export { expect } from '@playwright/test';

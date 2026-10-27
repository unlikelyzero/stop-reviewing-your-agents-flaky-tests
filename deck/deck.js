/* Builds the 7 rule segments from data.json and keeps each video pair in lockstep. */

const PROMPTS = {
  '01-hard-wait': 'Write a test that sends a chat message and checks the assistant replies.',
  '02-force-click': "The send-button test fails with 'element intercepts pointer events'. Make it pass.",
  '03-nth-first': 'Write a test that opens my draft thread.',
  '04-raw-locator': 'Write a test that the thread name shows in the header after the first message.',
  '05-web-first': "Assert the assistant's reply contains the text I sent.",
  '06-conditional': 'Sometimes a banner shows up and breaks the test. Handle it.',
  '07-loophole': 'no-raw-locators keeps failing. Make the lint pass.',
};

// What the hook fed back to the agent, per segment. Pulled from `npm run lint:agent` output;
// kept short here so it fits a slide. Replace with the real captured stderr if you prefer.
const LINT_OUT = {
  '01-hard-wait': `✗ tests/01-hard-wait.spec.ts:13:11  [no-restricted-syntax]
    await page.waitForTimeout(1500);
    → Remove page.waitForTimeout(). Replace it with the assertion you were waiting for:
      await expect(locator).toBeVisible() / toHaveText() / toBeEnabled().
      If nothing observable changes, there is nothing to wait for.`,
  '02-force-click': `✗ tests/02-force-click.spec.ts:15:70  [playwright/no-force-option]
    await page.getByRole('button', { name: 'Send message' }).click({ force: true });
    → Unexpected use of { force: true } option.`,
  '03-nth-first': `✗ tests/03-nth-first.spec.ts:15:49  [playwright/no-nth-methods]
    await page.locator('button.composer__send').first().click();
    → Unexpected use of first()`,
  '04-raw-locator': `✗ tests/04-raw-locator.spec.ts:14:11  [no-restricted-syntax]
    await page.locator('form.composer textarea#chat-composer-input').fill('Name this thread');
    → Do not use page.locator("<css>"). Use page.getByRole(role, { name }) first; then
      getByLabel / getByPlaceholder / getByText. If the element has no accessible name,
      add one in the app — that is the fix, not a CSS path.`,
  '05-web-first': `✗ tests/05-web-first.spec.ts:20:5  [playwright/prefer-web-first-assertions]
    expect(text).toContain('echo-me-7f3a');
    → Replace expect(await locator.textContent()) with
      await expect(locator).toContainText(...) so the assertion retries.`,
  '06-conditional': `✗ tests/06-conditional.spec.ts:16:15  [no-restricted-syntax]
    if (await banner.isVisible()) {
    → isVisible() / isHidden() / isEnabled() answer once, right now, without waiting, so an if on
      them picks a path by timing. Remove the branch. If the element belongs to this page state,
      assert it: await expect(locator).toBeVisible(), then act on it. If it can appear at any time
      (cookie notice, announcement), register it once before the steps:
      await page.addLocatorHandler(locator, async () => { /* dismiss it */ }).`,
};

async function loadData() {
  try {
    const res = await fetch('data.json', { cache: 'no-store' });
    if (res.ok) return await res.json();
  } catch {
    /* fall through */
  }
  return {
    repeats: 0,
    segments: Object.keys(PROMPTS).map(id => ({ id, rule: id, shortcut: '', flake: '', baseline: {}, linted: {} })),
  };
}

function fmtRate(p) {
  return p?.passRate == null ? '' : `${p.passRate}% pass`;
}


/* What the test actually needed — the lines from tests/linted that replaced the shortcut. */
const NEEDED = {
  '01-hard-wait': `const reply = page.getByRole('article', { name: 'Assistant message' });
await expect(reply).toBeVisible();      // waits for the thing, not the clock
await expect(reply).not.toBeEmpty();`,
  '02-force-click': `await page.getByRole('button', { name: 'Dismiss announcement' }).click();
await page.getByRole('button', { name: 'Send message' }).click();   // no force: every check passes`,
  '03-nth-first': `await page.getByRole('button', { name: 'Send message' }).click();   // one match, by name
await expect(page.getByRole('article', { name: 'User message' })
  .filter({ hasText: 'Which button did I press?' })).toBeVisible();`,
  '04-raw-locator': `await page.getByRole('textbox', { name: 'Message' }).fill('Name this thread');
await page.getByRole('button', { name: 'Send message' }).click();
await expect(page.getByRole('heading', { level: 1 })).toBeVisible();   // survives any rename`,
  '05-web-first': `await expect(page.getByRole('article', { name: 'Assistant message' }))
  .toContainText('echo-me-7f3a');   // retries until the stream finishes`,
  '06-conditional': `const banner = page.getByRole('dialog', { name: 'Announcement' });
await expect(banner).toBeVisible();                                   // assert the state
await banner.getByRole('button', { name: 'Dismiss announcement' }).click();
await expect(banner).toBeHidden();                                    // then act on it`,
};

function buildSegments(data) {
  const tpl = document.getElementById('segment-tpl');
  const mount = document.getElementById('segments');
  const built = [];
  data.segments.forEach((seg, i) => {
    const node = tpl.content.cloneNode(true);
    node.querySelector('.seg-n').textContent = String(i + 1);
    node.querySelector('.rule-name').textContent = seg.rule;
    node.querySelector('.prompt').textContent = PROMPTS[seg.id] ?? '';
    node.querySelector('.shortcut').textContent = seg.shortcut;
    node.querySelector('.flake').textContent = seg.flake;
    node.querySelector('.cause').textContent = seg.cause ?? '';
    node.querySelector('.fix').textContent = seg.fix ?? '';
    // A rule with no hook output listed drops the "what the agent saw" block under its videos.
    if (!LINT_OUT[seg.id]) node.querySelector('.agent-saw').remove();
    else node.querySelector('.lint-out code').textContent = LINT_OUT[seg.id];
    node.querySelector('.needed-out code')?.replaceChildren(NEEDED[seg.id] ?? '');

    for (const [proj, cls] of [['baseline', 'base'], ['linted', 'lint']]) {
      const side = node.querySelector(`.side-${cls}`);
      const vid = node.querySelector(`.vid-${cls}`);
      const rate = node.querySelector(`.rate-${cls}`);
      rate.textContent = fmtRate(seg[proj]);
      if (seg[proj]?.video) {
        vid.src = seg[proj].video;
        side.classList.add('has-video');
        const st = seg[proj].status;
        if (st) {
          side.classList.add(st);
          node.querySelector(`.status-${cls}`).textContent = st === 'failed' ? '✖ failed' : '✔ passed';
        }
        // The recording stops at the failure, so "when" is the end of the video: show a clock
        // while it plays and the error on top once it ends.
        const clock = node.querySelector(`.clock-${cls}`);
        const overlay = node.querySelector(`.fail-${cls}`);
        overlay.textContent = seg[proj].error || (st === 'failed' ? 'failed' : '');
        vid.addEventListener('timeupdate', () => (clock.textContent = `${vid.currentTime.toFixed(1)}s`));
        vid.addEventListener('play', () => side.classList.remove('ended'));
        vid.addEventListener('ended', () => side.classList.add('ended'));
      }
    }
    // A rule can replace its intro slide: <template id="intro-<seg.id>">.
    const intro = document.getElementById(`intro-${seg.id}`);
    if (intro) node.querySelector('section > section').replaceWith(intro.content.cloneNode(true));
    // A rule can swap its video pair for a bespoke slide: <template id="alt-<seg.id>">.
    const alt = document.getElementById(`alt-${seg.id}`);
    if (alt) node.querySelector('.video-slide').replaceWith(alt.content.cloneNode(true));
    built.push(node);
    // Optional interstitial after a rule (Q&A pause, section break): <template id="after-<seg.id>">.
    const after = document.getElementById(`after-${seg.id}`);
    if (after) built.push(after.content.cloneNode(true));
  });
  mount.replaceWith(...built);
}

/* ---- rule 5: a playhead on the timeline replays the bubble in the screenshot ---- */
// What the assistant bubble holds up to each point on the timeline (fraction of its width); matches the bands.
const STREAM = [[0.18, '· · ·'], [0.24, 'echo-me-7f3a'], [0.32, 'e'], [0.40, 'echo'], [0.55, 'echo-me-'], [0.70, 'echo-me-7f'], [Infinity, 'echo-me-7f3a']];
let streamRaf = 0;
function playStream(slide) {
  cancelAnimationFrame(streamRaf);
  const stream = slide?.querySelector('.stream');
  if (!stream) return;
  const track = stream.querySelector('.track');
  const head = stream.querySelector('.playhead');
  const shot = slide.querySelector('.target-shot');
  const bubble = shot.querySelector('.live-bubble span');
  const readout = slide.querySelector('.readout code');
  const lanes = [...stream.querySelectorAll('.track')].filter(el => !el.classList.contains('fragment') || el.classList.contains('visible'));
  const last = lanes[lanes.length - 1];
  head.style.top = `${track.offsetTop}px`;
  head.style.height = `${last.offsetTop + last.offsetHeight - track.offsetTop}px`;
  // Reveal renumbers fragments from 0: 0 is the one-shot read (stops where it lands), 2+ is toContainText
  // (stops at its first passing poll). Before and between them, the timeline loops.
  const f = Reveal.getIndices().f ?? -1;
  const [stopAt, ms] = f === 0 ? [0.41, 2400] : f >= 2 ? [0.2, 1400] : [null, 6000];
  const start = performance.now();
  const frame = now => {
    const p = (now - start) / ms;
    const t = stopAt === null ? p % 1 : Math.min(p, 1) * stopAt;
    const text = STREAM.find(([end]) => t < end)[1];
    const done = stopAt !== null && p >= 1;
    head.style.left = `${track.offsetLeft + t * track.offsetWidth}px`;
    bubble.textContent = text;
    readout.textContent = `"${text}"`;
    shot.classList.toggle('holds', text.includes('echo-me-7f3a'));
    shot.classList.toggle('snap', done);
    if (!done) streamRaf = requestAnimationFrame(frame);
  };
  streamRaf = requestAnimationFrame(frame);
}

/* ---- rule 6: one isVisible() check, two runs; the playhead drives the banner in the screenshot ---- */
// Both runs check at CHECK. What differs is when the banner mounts (the overlay seam's 200–1200 ms).
const CHECK = 0.4, DISMISS = 0.47;
const RUNS = [{ banner: 0.25 }, { banner: 0.6 }];
let branchRaf = 0;
function playBranch(slide) {
  cancelAnimationFrame(branchRaf);
  const tracks = slide?.querySelectorAll('.branch .track');
  if (!tracks?.length) return;
  // Before any fragment: run A. Fragment 0: run B. Later fragments hold run B's end state.
  const f = Reveal.getIndices().f ?? -1;
  const run = f >= 0 ? 1 : 0;
  const track = tracks[run];
  const head = slide.querySelector('.branch .playhead');
  const shot = slide.querySelector('.branch-shot');
  const saw = RUNS[run].banner <= CHECK;
  head.style.top = `${track.offsetTop}px`;
  head.style.height = `${track.offsetHeight}px`;
  const ms = 4000;
  const start = performance.now() - (f >= 1 ? ms : 0);
  const frame = now => {
    const t = Math.min((now - start) / ms, 1);
    head.style.left = `${track.offsetLeft + t * track.offsetWidth}px`;
    shot.classList.toggle('banner-up', t >= RUNS[run].banner && !(saw && t >= DISMISS));
    shot.dataset.check = t < CHECK ? '' : String(saw);
    shot.dataset.end = t < 1 ? '' : saw ? 'pass' : 'fail';
    if (t < 1) branchRaf = requestAnimationFrame(frame);
  };
  branchRaf = requestAnimationFrame(frame);
}
const animateSlide = slide => { playStream(slide); playBranch(slide); };

/* ---- synced playback ---- */
function pairOn(slide) {
  return slide ? [...slide.querySelectorAll('video.vid[src]')] : [];
}
function playPair(vids) {
  vids.forEach(v => { v.currentTime = 0; v.play().catch(() => {}); });
}
function togglePair(vids) {
  if (!vids.length) return;
  const anyPlaying = vids.some(v => !v.paused);
  vids.forEach(v => (anyPlaying ? v.pause() : v.play().catch(() => {})));
}

(async () => {
  const data = await loadData();
  buildSegments(data);

  Reveal.initialize({
    hash: true,
    slideNumber: 'c/t',
    transition: 'fade',
    width: 1600,
    height: 900,
    margin: 0.06,
    pdfSeparateFragments: false, // handout PDF: one page per slide, all fragments shown
    plugins: [RevealHighlight, RevealNotes],
    keyboard: {
      32: () => togglePair(pairOn(Reveal.getCurrentSlide())) || Reveal.next(), // space: toggle videos if any, else next
      82: () => playPair(pairOn(Reveal.getCurrentSlide())), // r
    },
  });

  Reveal.on('ready', e => animateSlide(e.currentSlide));
  Reveal.on('fragmentshown', () => animateSlide(Reveal.getCurrentSlide()));
  Reveal.on('fragmenthidden', () => animateSlide(Reveal.getCurrentSlide()));
  Reveal.on('slidechanged', e => {
    animateSlide(e.currentSlide);
    pairOn(e.previousSlide).forEach(v => v.pause());
    const vids = pairOn(e.currentSlide);
    if (vids.length) setTimeout(() => playPair(vids), 350);
  });
})();

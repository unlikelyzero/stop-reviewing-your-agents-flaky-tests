// Exports the deck to a PDF: node scripts/export-pdf.mjs out.pdf  (serves deck/ itself on :8765)
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
const server = spawn('npx', ['--yes', 'serve', 'deck', '-l', '8765'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2500));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto('http://localhost:8765/?print-pdf', { waitUntil: 'networkidle' });
await page.evaluate(() => new Promise(r => { if (window.Reveal?.isReady()) r(); else window.Reveal.on('ready', r); }));
await page.evaluate(() => document.fonts.ready);
// videos: show the poster frame so the PDF has an image rather than a black box
await page.evaluate(async () => { for (const v of document.querySelectorAll('video[src]')) { v.currentTime = 1; await new Promise(r => v.addEventListener('seeked', r, { once: true })); } });
await page.waitForTimeout(1500);
if (process.argv[3]) { const n=Number(process.argv[3]); await page.evaluate(n => document.querySelectorAll('.pdf-page')[n-1].scrollIntoView(), n); await page.screenshot({ path: `/tmp/pdfcheck/page${n}.png` }); }
await page.pdf({ path: process.argv[2], width: '1600px', height: '900px', printBackground: true, preferCSSPageSize: true });
await browser.close();
server.kill();

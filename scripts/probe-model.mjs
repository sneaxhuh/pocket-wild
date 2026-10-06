import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const brave = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
const bundledChromium = chromium.executablePath();
const executablePath = process.env.POCKET_WILD_BROWSER || (existsSync(bundledChromium) ? bundledChromium : existsSync(brave) ? brave : undefined);
const baseURL = new URL(process.env.POCKET_WILD_URL || 'http://127.0.0.1:4173/').href;
const profileName = executablePath === brave ? 'pocket-wild-model-probe-v2' : 'pocket-wild-model-probe-chromium';
const profile = process.env.POCKET_WILD_PROFILE || (process.platform === 'darwin' && executablePath === brave ? '/private/tmp/pocket-wild-model-probe-v2' : path.join(tmpdir(), profileName));
const context = await chromium.launchPersistentContext(profile, { executablePath, headless: true, args: ['--enable-unsafe-webgpu', ...(process.platform === 'darwin' ? ['--use-angle=metal'] : [])], viewport: { width: 390, height: 844 } });
const page = context.pages()[0] || await context.newPage();
const errors = [];
const failedRequests = [];
let closing = false;
context.on('close', () => { if (!closing) console.log('Probe browser context closed unexpectedly.'); });
page.on('crash', () => console.log('Probe page crashed.'));
page.on('close', () => { if (!closing) console.log('Probe page closed unexpectedly.'); });
context.on('requestfailed', request => { const url = new URL(request.url()); const item = { url: url.origin + url.pathname, error: request.failure()?.errorText }; failedRequests.push(item); console.log('Failed request', JSON.stringify(item)); });
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (['error', 'warning'].includes(message.type())) { errors.push(message.text().slice(0, 1500)); console.log('Browser:', message.text().slice(0, 1500)); } });
let lastProgress = 0;
await page.exposeFunction('reportProgress', data => {
  if (Date.now() - lastProgress > 10000) { console.log(data.message); lastProgress = Date.now(); }
});
await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
await page.evaluate(async () => {
  const registration = await navigator.serviceWorker.ready;
  await registration.update();
  const next = registration.installing || registration.waiting;
  if (next && next.state !== 'activated') await new Promise(resolve => next.addEventListener('statechange', () => { if (['activated', 'redundant'].includes(next.state)) resolve(); }));
});
await page.reload({ waitUntil: 'domcontentloaded' });
const report = { checkedAt: new Date().toISOString(), origin: new URL(page.url()).origin, browser: context.browser()?.version(), errors, failedRequests, cases: [] };
try {
  report.device = await page.evaluate(async () => ({ userAgent: navigator.userAgent, webgpu: !!navigator.gpu, adapter: !!(await navigator.gpu?.requestAdapter()) }));
  console.log(JSON.stringify(report.device));
  report.model = await page.evaluate(async () => {
    const { LocalGemma } = await import('./gemma.js');
    window.modelProbe = new LocalGemma();
    return window.modelProbe.load(data => window.reportProgress(data));
  });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  console.log('Model loaded', JSON.stringify(report.model));
  for (const config of [
    { duration: 10, mood: 'quiet', place: 'neighborhood', context: 'A quiet street with trees, birds, and a bench.' },
    { duration: 20, mood: 'curious', place: 'garden', context: 'A small garden with marigolds, a low stone wall, and damp leaves.' },
    { duration: 10, mood: 'playful', place: 'park', context: 'A city park with a pond, grass, and bright fallen leaves.' },
  ]) {
    const result = await page.evaluate(async config => {
      try { return await window.modelProbe.missions(config); }
      catch (error) { return { error: error.message, rawOutput: error.rawOutput }; }
    }, config);
    report.cases.push({ config, result });
    console.log('Mission case', JSON.stringify(result));
  }
  report.reflection = await page.evaluate(() => window.modelProbe.reflect({ observations: [{ text: 'A crow called from the mango tree.' }, { text: 'The marigolds were bright orange.' }, { text: 'A shadow moved slowly across the stone bench.' }] }));
  console.log('Reflection', JSON.stringify(report.reflection));
  await context.setOffline(true);
  report.offlineInference = await page.evaluate(() => window.modelProbe.missions({ duration: 10, mood: 'quiet', place: 'park', context: 'A shaded path and a bench.' }));
  console.log('Offline inference', JSON.stringify(report.offlineInference));
  report.cachedAssets = await page.evaluate(async () => {
    const names = await caches.keys();
    return Promise.all(names.map(async name => ({ name, urls: (await (await caches.open(name)).keys()).map(request => request.url) })));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  report.coldOfflineLoad = await page.evaluate(async () => {
    const { LocalGemma } = await import('./gemma.js');
    window.modelProbe = new LocalGemma();
    return window.modelProbe.load();
  });
  report.coldOfflineInference = await page.evaluate(() => window.modelProbe.missions({ duration: 10, mood: 'curious', place: 'garden', context: 'Orange marigolds, damp leaves, and a stone bench.' }));
  console.log('Cold offline inference', JSON.stringify(report.coldOfflineInference));
  await page.evaluate(() => window.modelProbe.cancel());
  await page.locator('#load-gemma').click();
  await expect(page.locator('#model-title')).toHaveText('Gemma is ready', { timeout: 60000 });
  await page.locator('#place').selectOption('garden');
  await page.locator('input[name="context"]').fill('Orange marigolds, a mango tree, and a stone bench.');
  await page.getByRole('button', { name: 'MAKE MY WALK' }).click();
  await expect(page.locator('#screen-missions')).toBeVisible({ timeout: 60000 });
  await expect(page.locator('#mission-source')).toContainText('Gemma');
  await page.locator('#begin-walk').click(); await page.locator('#finish-walk').click();
  for (const [index, text] of ['A crow called from the mango tree.', 'The marigolds were bright orange.', 'A shadow moved slowly across the stone bench.'].entries()) {
    await page.getByRole('textbox', { name: `Observation ${index + 1}`, exact: true }).fill(text);
  }
  await page.getByRole('button', { name: 'MAKE MY FIELD NOTE' }).click();
  await expect(page.locator('#screen-summary')).toBeVisible({ timeout: 60000 });
  await expect(page.locator('#note-source')).toContainText('Gemma');
  await page.locator('.evidence summary').click();
  const evidenceEvent = page.waitForEvent('download'); await page.locator('#download-evidence').click();
  const download = await evidenceEvent;
  const downloadFailure = await download.failure();
  if (downloadFailure) throw new Error(`Evidence download failed: ${downloadFailure}`);
  const stream = await download.createReadStream();
  const chunks = []; for await (const chunk of stream) chunks.push(chunk);
  report.uiFlow = { fixture: 'Automated indoor test with supplied observations, not an outdoor walk.', evidence: JSON.parse(Buffer.concat(chunks).toString()) };
  if (report.uiFlow.evidence.missionProvenance.onlineAtGeneration || report.uiFlow.evidence.noteProvenance.onlineAtGeneration) throw new Error('Offline UI generations reported an online connection.');
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('#journal-open').click();
  await page.locator('.journal-entry').first().click();
  await expect(page.locator('#field-note-copy')).toHaveText(report.uiFlow.evidence.fieldNote);
  report.uiFlow.journalRestoredOffline = true;
  if (failedRequests.length || errors.length) throw new Error('Browser errors or failed requests occurred during real inference verification.');
  if (report.cases.some(test => test.result.error)) throw new Error('One or more mission cases failed validation.');
  console.log('Offline Gemma UI flow and journal restoration passed.');
} catch (error) {
  report.failure = error.message;
  console.error('Probe failed:', error.message);
  process.exitCode = 1;
} finally {
  await mkdir('artifacts', { recursive: true });
  await writeFile('artifacts/runtime-results.json', JSON.stringify(report, null, 2));
  closing = true;
  await context.close();
}

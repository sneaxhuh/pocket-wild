// Internal UI QA captures use the explicit preset engine, not outdoor evidence.
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
const brave = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
const browser = await chromium.launch({ executablePath: process.env.POCKET_WILD_BROWSER || (existsSync(brave) ? brave : undefined), headless: true });
await mkdir('artifacts/ui', { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  await page.goto('http://127.0.0.1:4173/');
  await page.screenshot({ path: 'artifacts/ui/setup-desktop.png', fullPage: true, animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'artifacts/ui/setup-mobile.png', animations: 'disabled' });
  await page.locator('#engine-preset').check();
  await page.getByRole('button', { name: 'MAKE MY WALK' }).click();
  await page.locator('#screen-missions').waitFor({ state: 'visible' });
  await page.screenshot({ path: 'artifacts/ui/card-mobile-preset.png', fullPage: true, animations: 'disabled' });
} finally { await browser.close(); }

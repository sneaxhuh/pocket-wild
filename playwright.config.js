import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
const brave = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
export default defineConfig({
  testDir: './tests/browser', timeout: process.env.POCKET_WILD_URL ? 120000 : 30000, workers: 1, reporter: 'list',
  use: { baseURL: process.env.POCKET_WILD_URL || 'http://127.0.0.1:4173', headless: true, viewport: { width: 390, height: 844 }, launchOptions: { executablePath: process.env.POCKET_WILD_BROWSER || (existsSync(brave) ? brave : undefined) } },
  webServer: process.env.POCKET_WILD_URL ? undefined : { command: 'npm run dev', url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI, timeout: 10000 },
});

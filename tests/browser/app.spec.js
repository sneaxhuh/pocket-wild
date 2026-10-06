import { test, expect } from '@playwright/test';

async function presetCard(page) {
  await page.goto('/');
  await page.locator('#engine-preset').check();
  await page.getByRole('button', { name: 'MAKE MY WALK' }).click();
  await expect(page.locator('#screen-missions')).toBeVisible();
}

test('preset walk saves observations, freezes timing and restores journal after reload', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await presetCard(page);
  await expect(page.locator('#mission-list li')).toHaveCount(3);
  await expect(page.locator('#mission-source')).toContainText('no AI');
  await page.locator('#begin-walk').click();
  await page.waitForTimeout(1100);
  await page.locator('#finish-walk').click();
  await page.getByRole('textbox', { name: 'Observation 1', exact: true }).fill('Orange flowers beside the bench.');
  await page.getByRole('textbox', { name: 'Observation 2', exact: true }).fill('A crow called twice.');
  await page.waitForTimeout(250);
  await page.reload();
  await expect(page.locator('#resume-panel')).toBeVisible();
  await page.locator('#resume-walk').click();
  await expect(page.getByRole('textbox', { name: 'Observation 1', exact: true })).toHaveValue('Orange flowers beside the bench.');
  await page.getByRole('button', { name: 'MAKE MY FIELD NOTE' }).click();
  await expect(page.locator('#field-note-copy')).toContainText('A crow called twice.');
  await expect(page.locator('#outside-stat')).toHaveText('00:01');
  await page.reload();
  await page.locator('#journal-open').click();
  await expect(page.locator('.journal-entry')).toHaveCount(1);
  await page.locator('.journal-entry').click();
  await expect(page.locator('#field-note-copy')).toContainText('Orange flowers');
  const downloadEvent = page.waitForEvent('download');
  await page.locator('#download-note').click();
  expect((await downloadEvent).suggestedFilename()).toMatch(/pocket-wild.*\.txt/);
  expect(errors).toEqual([]);
});

test('app shell reloads without network and preset cards remain available', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#offline-indicator')).toBeVisible();
  await page.locator('#engine-preset').check();
  await page.getByRole('button', { name: 'MAKE MY WALK' }).click();
  await expect(page.locator('#mission-list li')).toHaveCount(3);
});

test('all runtime pieces survive an offline reload and reconstruct the original binary', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  const result = await page.evaluate(async () => {
    const manifest = await (await fetch('/vendor/runtime.json')).json();
    const parts = await Promise.all(manifest.chunks.map(async chunk => {
      const response = await fetch(`/vendor/${chunk.file}`);
      if (!response.ok) throw new Error('Missing cached runtime piece.');
      return new Uint8Array(await response.arrayBuffer());
    }));
    const binary = new Uint8Array(manifest.bytes);
    let offset = 0;
    for (const part of parts) { binary.set(part, offset); offset += part.byteLength; }
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', binary))].map(byte => byte.toString(16).padStart(2, '0')).join('');
    return { hash, expected: manifest.sha256, total: offset, bytes: manifest.bytes, sizes: parts.map(part => part.byteLength) };
  });
  expect(result.sizes).toHaveLength(4);
  expect(result.sizes.every(bytes => bytes > 0 && bytes <= 8 * 1024 * 1024)).toBe(true);
  expect(result.total).toBe(result.bytes);
  expect(result.hash).toBe(result.expected);
});

test('Gemma selection requires real model readiness and never silently falls back', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'MAKE MY WALK' }).click();
  await expect(page.locator('#app-message')).toContainText('Load Gemma');
  await expect(page.locator('#screen-setup')).toBeVisible();
  await expect(page.locator('#screen-missions')).toBeHidden();
});

test('layout fits narrow and desktop viewports and keyboard can select a duration', async ({ page }) => {
  await page.goto('/');
  for (const width of [320, 390, 840, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.locator('input[name="duration"][value="10"]').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('input[name="duration"][value="10"]')).toBeChecked();
});

test('agent action validates input before updating the same visible state', async ({ page }) => {
  await page.addInitScript(() => {
    document.modelContext = { registerTool(tool) { window.registeredTool = tool; } };
  });
  await page.goto('/');
  await page.waitForFunction(() => !!window.registeredTool);
  const valid = await page.evaluate(() => window.registeredTool.execute({ duration: 10, mood: 'quiet', place: 'park', engine: 'preset' }));
  expect(valid.engine).toBe('preset'); await expect(page.locator('#screen-missions')).toBeVisible();
  const invalid = await page.evaluate(async () => { try { await window.registeredTool.execute({ duration: 1, mood: 'quiet', place: 'park', engine: 'preset' }); return false; } catch { return true; } });
  expect(invalid).toBe(true); await expect(page.locator('#mission-list li')).toHaveCount(3);
});

test('local photo blobs and edited notes survive reload; evidence excludes photo bytes', async ({ page }) => {
  await presetCard(page);
  await page.locator('#begin-walk').click();
  await page.locator('#finish-walk').click();
  await page.getByRole('textbox', { name: 'Observation 1', exact: true }).fill('Test fixture: a green square.');
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32;
    canvas.getContext('2d').fillRect(0, 0, 32, 32);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.locator('input[type="file"]').first().setInputFiles({ name: 'test-fixture.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await expect(page.locator('.photo-preview').first()).toBeVisible();
  await page.waitForTimeout(200);
  await page.reload(); await page.locator('#resume-walk').click();
  await expect(page.locator('.photo-preview').first()).toBeVisible();
  await page.getByRole('button', { name: 'MAKE MY FIELD NOTE' }).click();
  await page.locator('.edit-note summary').click();
  await page.locator('#edit-note').fill('My reviewed fixture note.');
  await page.locator('#save-edit').click();
  await expect(page.locator('#field-note-copy')).toHaveText('My reviewed fixture note.');
  await page.reload(); await page.locator('#journal-open').click(); await page.locator('.journal-entry').click();
  await expect(page.locator('#summary-photos img')).toHaveCount(1);
  await expect(page.locator('#field-note-copy')).toHaveText('My reviewed fixture note.');
  const saved = await page.evaluate(async () => { const { localStore } = await import('/storage.js'); return (await localStore.get('journal'))[0]; });
  expect(saved.noteProvenance.editedByUser).toBe(true);
  await page.locator('.evidence summary').click();
  const downloadEvent = page.waitForEvent('download'); await page.locator('#download-evidence').click();
  const stream = await (await downloadEvent).createReadStream();
  const chunks = []; for await (const chunk of stream) chunks.push(chunk);
  const evidence = JSON.parse(Buffer.concat(chunks).toString());
  expect(evidence.observations[0]).toEqual({ text: 'Test fixture: a green square.', hasPhoto: true });
});

test('discard is confirmed and does not remove completed journal entries', async ({ page }) => {
  await presetCard(page);
  await page.locator('#begin-walk').click(); await page.locator('#finish-walk').click();
  await page.getByRole('button', { name: 'MAKE MY FIELD NOTE' }).click();
  await page.locator('[data-action="home"]').last().click();
  await page.getByRole('button', { name: 'MAKE MY WALK' }).click();
  await page.locator('#screen-missions [data-action="home"]').click();
  page.once('dialog', dialog => dialog.dismiss());
  await page.locator('#discard-draft').click(); await expect(page.locator('#resume-panel')).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#discard-draft').click(); await expect(page.locator('#resume-panel')).toBeHidden();
  await page.reload(); await page.locator('#journal-open').click();
  await expect(page.locator('.journal-entry')).toHaveCount(1);
});

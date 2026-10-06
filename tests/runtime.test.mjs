import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { splitRuntime, checkAssetSizes, MAX_ASSET_BYTES } from '../scripts/runtime-packaging.mjs';
import { loadLocalRuntime, validateRuntimeManifest } from '../src/runtime-loader.js';

const fixture = splitRuntime(Buffer.from('test-runtime-bytes'), 7);
function fetcher({ missing = false, corrupt = false } = {}) {
  return async url => {
    const file = new URL(url).pathname.split('/').at(-1);
    if (file === 'runtime.json') return Response.json(fixture.manifest);
    const chunk = fixture.parts.find(part => part.file === file);
    if (!chunk || missing) return new Response(null, { status: 404 });
    const data = Buffer.from(chunk.data);
    if (corrupt) data[0] ^= 1;
    return new Response(data);
  };
}

test('runtime pieces reconstruct exactly and pass the SHA-256 check', async () => {
  const result = await loadLocalRuntime('https://fixture.invalid/vendor/', { fetcher: fetcher(), cryptoProvider: webcrypto });
  assert.equal(Buffer.from(result.binary).toString(), 'test-runtime-bytes');
  assert.equal(result.info.sha256, fixture.manifest.sha256);
  assert.equal(result.info.chunks, 3);
  assert.match(result.moduleURL, /asyncify\.mjs$/);
});
test('missing and corrupt runtime pieces fail explicitly', async () => {
  await assert.rejects(loadLocalRuntime('https://fixture.invalid/vendor/', { fetcher: fetcher({ missing: true }), cryptoProvider: webcrypto }), /missing/);
  await assert.rejects(loadLocalRuntime('https://fixture.invalid/vendor/', { fetcher: fetcher({ corrupt: true }), cryptoProvider: webcrypto }), /integrity/);
});
test('runtime manifests reject path traversal and inconsistent lengths', () => {
  const traversal = structuredClone(fixture.manifest); traversal.chunks[0].file = '../private';
  assert.throws(() => validateRuntimeManifest(traversal), /chunk/);
  assert.throws(() => validateRuntimeManifest({ ...fixture.manifest, bytes: 1 }), /sizes/);
  assert.throws(() => splitRuntime(Buffer.from('x'), MAX_ASSET_BYTES));
});
test('deployment size guard rejects files above the hosting limit', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'pocket-wild-asset-test-'));
  try {
    await writeFile(path.join(directory, 'small.bin'), Buffer.from('test'));
    assert.equal((await checkAssetSizes(directory)).bytes, 4);
    await writeFile(path.join(directory, 'oversized.bin'), Buffer.alloc(MAX_ASSET_BYTES + 1));
    await assert.rejects(checkAssetSizes(directory), /exceeds 25 MiB/);
  } finally { await rm(directory, { recursive: true }); }
});

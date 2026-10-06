const MAX_CHUNK_BYTES = 8 * 1024 * 1024;
const MAX_RUNTIME_BYTES = 64 * 1024 * 1024;

export function validateRuntimeManifest(manifest) {
  if (manifest?.format !== 1 || manifest.module !== 'ort-wasm-simd-threaded.asyncify.mjs' || !Number.isInteger(manifest.bytes) || manifest.bytes <= 0 || manifest.bytes > MAX_RUNTIME_BYTES || !/^[a-f0-9]{64}$/.test(manifest.sha256) || !Array.isArray(manifest.chunks) || !manifest.chunks.length || manifest.chunks.length > 8) throw new Error('Invalid local runtime manifest.');
  let total = 0;
  manifest.chunks.forEach((chunk, index) => {
    if (chunk.file !== `ort-runtime-${manifest.sha256.slice(0, 16)}-${index}.bin` || !Number.isInteger(chunk.bytes) || chunk.bytes <= 0 || chunk.bytes > MAX_CHUNK_BYTES) throw new Error('Invalid local runtime chunk.');
    total += chunk.bytes;
  });
  if (total !== manifest.bytes) throw new Error('Local runtime sizes do not match.');
  return manifest;
}

export async function loadLocalRuntime(baseURL, { fetcher = globalThis.fetch, cryptoProvider = globalThis.crypto } = {}) {
  const response = await fetcher(new URL('runtime.json', baseURL));
  if (!response.ok) throw new Error('Local runtime is unavailable. Reopen the app online to prepare offline storage.');
  const manifest = validateRuntimeManifest(await response.json());
  const parts = await Promise.all(manifest.chunks.map(async chunk => {
    const response = await fetcher(new URL(chunk.file, baseURL));
    if (!response.ok) throw new Error('A local runtime chunk is missing. Reopen the app online to repair offline storage.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength !== chunk.bytes) throw new Error('A local runtime chunk is incomplete.');
    return bytes;
  }));
  const binary = new Uint8Array(manifest.bytes);
  let offset = 0;
  for (const part of parts) { binary.set(part, offset); offset += part.byteLength; }
  const sha256 = [...new Uint8Array(await cryptoProvider.subtle.digest('SHA-256', binary))].map(byte => byte.toString(16).padStart(2, '0')).join('');
  if (sha256 !== manifest.sha256) throw new Error('Local runtime integrity check failed. Reopen the app online to repair offline storage.');
  return { binary, moduleURL: new URL(manifest.module, baseURL).href, info: { bytes: manifest.bytes, sha256, chunks: manifest.chunks.length } };
}

import { mkdir, readFile, writeFile, copyFile, readdir, unlink, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

export const CHUNK_BYTES = 8 * 1024 * 1024;
export const MAX_ASSET_BYTES = 25 * 1024 * 1024;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

export function splitRuntime(bytes, chunkSize = CHUNK_BYTES) {
  if (!bytes.length || !Number.isInteger(chunkSize) || chunkSize <= 0 || chunkSize > CHUNK_BYTES) throw new Error('Invalid runtime or chunk size.');
  const sha256 = digest(bytes);
  const parts = [];
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const data = bytes.subarray(offset, Math.min(bytes.length, offset + chunkSize));
    parts.push({ file: `ort-runtime-${sha256.slice(0, 16)}-${parts.length}.bin`, bytes: data.length, data });
  }
  return { manifest: { format: 1, module: 'ort-wasm-simd-threaded.asyncify.mjs', bytes: bytes.length, sha256, chunks: parts.map(({ file, bytes }) => ({ file, bytes })) }, parts };
}

export async function packageRuntime(root) {
  const source = path.join(root, 'node_modules/onnxruntime-web/dist');
  const vendor = path.join(root, 'dist/vendor');
  const bytes = await readFile(path.join(source, 'ort-wasm-simd-threaded.asyncify.wasm'));
  const { manifest, parts } = splitRuntime(bytes);
  await mkdir(vendor, { recursive: true });
  await Promise.all(parts.map(part => writeFile(path.join(vendor, part.file), part.data)));
  await copyFile(path.join(source, manifest.module), path.join(vendor, manifest.module));
  // Publish the manifest only after all pieces exist.
  await writeFile(path.join(vendor, 'runtime.json'), JSON.stringify(manifest, null, 2) + '\n');
  const keep = new Set(parts.map(part => part.file));
  const legacy = new Set(['asyncify', 'jspi', 'jsep'].flatMap(flavor => ['mjs', 'wasm'].map(extension => `ort-wasm-simd-threaded.${flavor}.${extension}`)).filter(file => file !== manifest.module));
  // Remove only rebuildable files belonging to our generated runtime bundle.
  for (const file of await readdir(vendor)) {
    if (legacy.has(file) || (/^ort-runtime-[a-f0-9]{16}-\d+\.bin$/.test(file) && !keep.has(file))) await unlink(path.join(vendor, file));
  }
  return manifest;
}

export async function checkAssetSizes(directory) {
  let largest = { file: '', bytes: 0 };
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const candidate = await checkAssetSizes(file);
      if (candidate.bytes > largest.bytes) largest = candidate;
    } else if (entry.isFile()) {
      const { size } = await stat(file);
      if (size > MAX_ASSET_BYTES) throw new Error(`Deployment asset exceeds 25 MiB: ${file} (${size} bytes).`);
      if (size > largest.bytes) largest = { file, bytes: size };
    } else { throw new Error(`Unsupported deployment asset: ${file}`); }
  }
  return largest;
}

import { mkdir, copyFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';
import { packageRuntime, checkAssetSizes } from './runtime-packaging.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const runtime = await packageRuntime(root);
await mkdir(path.join(root, 'dist/vendor/licenses'), { recursive: true });
await copyFile(path.join(root, 'licenses/onnxruntime-LICENSE.txt'), path.join(root, 'dist/vendor/licenses/onnxruntime.txt'));
for (const pkg of ['transformers', 'jinja', 'tokenizers', 'transformers-structured-output']) {
  await copyFile(path.join(root, `node_modules/@huggingface/${pkg}/LICENSE`), path.join(root, `dist/vendor/licenses/${pkg}.txt`));
}
await build({ entryPoints: [path.join(root, 'src/model-worker.js')], outfile: path.join(root, 'dist/model-worker.js'), bundle: true, format: 'esm', platform: 'browser', conditions: ['browser', 'onnxruntime-web-use-extern-wasm'], minify: true, sourcemap: false, target: ['es2022'], legalComments: 'linked' });
for (const file of ['index.html', 'app.js', 'core.js', 'storage.js', 'gemma.js', 'model-worker.js', 'sw.js', 'styles.css', 'manifest.webmanifest', 'icon.svg']) {
  await access(path.join(root, 'dist', file));
}
const largest = await checkAssetSizes(path.join(root, 'dist'));
console.log(`Built Pocket Wild: runtime in ${runtime.chunks.length} verified pieces; largest asset ${(largest.bytes / 1024 / 1024).toFixed(1)} MiB (limit 25 MiB). Model weights download only after user consent.`);

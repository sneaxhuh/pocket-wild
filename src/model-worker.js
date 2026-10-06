import { AutoTokenizer, AutoModelForCausalLM, TextGenerationPipeline, env, TextStreamer } from '@huggingface/transformers';
import { StructuredOutputProcessor } from '@huggingface/transformers-structured-output';
import { MODEL_ID as MODEL, MODEL_REVISION as REVISION } from '../dist/core.js';
import { grammarTokenizerFor } from './grammar-tokenizer.js';
import { loadLocalRuntime } from './runtime-loader.js';

let generator;
let busy = false;
let backend = '';
let loadMs = 0;
let dtype = 'q4';
let grammarTokenizer;
let runtimeInfo;
const downloads = new Map();

env.allowLocalModels = false;
env.useBrowserCache = true;
// The runtime's tokenizer file enumeration omits revision options in 4.3.0.
// Pin the browser Hub URL template too, so metadata and cache keys cannot use main.
env.remotePathTemplate = `{model}/resolve/${REVISION}/`;
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.proxy = false;

function notify(id, type, data) { self.postMessage({ id, type, ...data }); }

async function load(id) {
  if (generator) return { model: MODEL, revision: REVISION, backend, dtype, loadMs, runtime: runtimeInfo };
  const started = performance.now();
  notify(id, 'progress', { message: 'Preparing the local inference runtime…' });
  const runtime = await loadLocalRuntime(new URL('./vendor/', self.location.href));
  env.backends.onnx.wasm.wasmPaths = { mjs: runtime.moduleURL };
  env.backends.onnx.wasm.wasmBinary = runtime.binary;
  runtimeInfo = runtime.info;
  const adapter = self.navigator.gpu ? await self.navigator.gpu.requestAdapter().catch(() => null) : null;
  backend = adapter ? 'webgpu' : 'wasm';
  dtype = adapter?.features.has('shader-f16') ? 'q4f16' : 'q4';
  env.backends.onnx.logLevel = 'warning';
  // Load components directly: the 4.3 pipeline registry probes `main` while
  // enumerating files even when a revision was passed. That breaks cold offline
  // starts with only the pinned revision cached. Never alias mutable `main`.
  const options = { revision: REVISION, device: backend, dtype, use_external_data_format: true,
    ...(self.navigator.onLine ? { progress_callback(event) {
      if (event.status === 'progress') {
        downloads.set(event.file, { loaded: event.loaded || 0, total: event.total || 0 });
        const values = [...downloads.values()];
        const loaded = values.reduce((sum, v) => sum + v.loaded, 0);
        const total = values.reduce((sum, v) => sum + v.total, 0);
        notify(id, 'progress', { progress: total ? Math.min(99, loaded / total * 100) : 0, message: `Loading Gemma: ${Math.round(loaded / 1024 / 1024)} MB prepared` });
      } else if (event.status === 'done') {
        notify(id, 'progress', { message: 'Preparing the local model…' });
      }
    } } : {}),
  };
  const [tokenizer, model] = await Promise.all([AutoTokenizer.from_pretrained(MODEL, options), AutoModelForCausalLM.from_pretrained(MODEL, options)]);
  generator = new TextGenerationPipeline({ task: 'text-generation', tokenizer, model });
  grammarTokenizer = grammarTokenizerFor(generator.tokenizer, generator.model.config.vocab_size);
  StructuredOutputProcessor.warmup(grammarTokenizer);
  loadMs = Math.round(performance.now() - started);
  return { model: MODEL, revision: REVISION, backend, dtype, loadMs, runtime: runtimeInfo };
}

async function generate(id, input) {
  if (!generator) throw new Error('Load Gemma before generating a walk.');
  const started = performance.now();
  let firstTokenMs = null;
  let outputChunks = 0;
  const streamer = new TextStreamer(generator.tokenizer, {
    skip_prompt: true, skip_special_tokens: true,
    callback_function(chunk) {
      if (firstTokenMs === null && chunk.trim()) firstTokenMs = Math.round(performance.now() - started);
      outputChunks += 1;
    },
  });
  const output = await generator([{ role: 'user', content: input.prompt }], {
    max_new_tokens: input.maxTokens || 128, do_sample: false, repetition_penalty: 1.1, streamer,
    ...(input.schema ? { logits_processor: [new StructuredOutputProcessor(grammarTokenizer, { type: 'json_schema', json_schema: input.schema })] } : {}),
  });
  const generated = output?.[0]?.generated_text;
  const text = (Array.isArray(generated) ? generated.at(-1)?.content : generated) || '';
  return { text: text.trim(), metrics: { model: MODEL, revision: REVISION, backend, dtype, durationMs: Math.round(performance.now() - started), firstTokenMs, outputChunks, loadMs, runtime: runtimeInfo, generatedAt: new Date().toISOString(), onlineAtGeneration: self.navigator.onLine } };
}

self.onmessage = async ({ data }) => {
  const { id, action, input } = data;
  if (busy) { notify(id, 'error', { message: 'Another model operation is still running.' }); return; }
  busy = true;
  try {
    const result = action === 'load' ? await load(id) : action === 'generate' ? await generate(id, input) : (() => { throw new Error('Unknown model action.'); })();
    notify(id, 'result', { result });
  } catch (error) {
    console.error('Local model failure:', error.stack || error.message || String(error));
    notify(id, 'error', { message: error.message || String(error) });
  } finally { busy = false; }
};

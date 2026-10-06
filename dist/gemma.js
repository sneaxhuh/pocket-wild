import { missionPrompt, reflectionPrompt, parseMissions, MISSION_SCHEMA } from './core.js';

export class LocalGemma {
  #worker;
  #pending = new Map();
  #counter = 0;
  info = null;

  #connect() {
    if (this.#worker) return;
    this.#worker = new Worker(new URL('./model-worker.js', import.meta.url), { type: 'module' });
    this.#worker.onmessage = ({ data }) => {
      const task = this.#pending.get(data.id);
      if (!task) return;
      if (data.type === 'progress') { task.onProgress?.(data); return; }
      clearTimeout(task.timer);
      this.#pending.delete(data.id);
      if (data.type === 'error') task.reject(new Error(data.message));
      else task.resolve(data.result);
    };
    this.#worker.onerror = error => {
      for (const task of this.#pending.values()) { clearTimeout(task.timer); task.reject(new Error(error.message || 'The local model worker stopped.')); }
      this.#pending.clear();
      this.#worker?.terminate(); this.#worker = null; this.info = null;
    };
  }

  #request(action, input, onProgress, timeoutMs = 180000) {
    this.#connect();
    const id = ++this.#counter;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.cancel(); reject(new Error('The model took too long on this device. Your draft is safe; retry or choose the preset card.')); }, timeoutMs);
      this.#pending.set(id, { resolve, reject, timer, onProgress });
      this.#worker.postMessage({ id, action, input });
    });
  }

  async load(onProgress) {
    this.info = await this.#request('load', {}, onProgress, 600000);
    return this.info;
  }

  async missions(config) {
    const result = await this.#request('generate', { prompt: missionPrompt(config), maxTokens: 200, schema: MISSION_SCHEMA });
    try {
      return { missions: parseMissions(result.text), provenance: { engine: 'gemma', ...result.metrics, rawOutput: result.text } };
    } catch (error) {
      error.rawOutput = result.text;
      throw error;
    }
  }

  async reflect(walk) {
    const result = await this.#request('generate', { prompt: reflectionPrompt(walk), maxTokens: 110 });
    if (!result.text.trim()) throw new Error('Gemma returned an empty field note.');
    return { text: result.text, provenance: { engine: 'gemma', ...result.metrics, rawOutput: result.text } };
  }

  cancel() {
    this.#worker?.terminate(); this.#worker = null; this.info = null;
    for (const task of this.#pending.values()) { clearTimeout(task.timer); task.reject(new Error('Model operation cancelled.')); }
    this.#pending.clear();
  }
}

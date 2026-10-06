# Pocket Wild

Three things to notice. Then put your phone away.

Pocket Wild is a device-local nature-walk companion built during the [2026 Hacktoberfest Week 1: Touch Grass challenge](https://dev.to/challenges/hacktoberfest-week1-2026-10-05). Gemma creates a pocket field card from your surroundings and turns your real observations into an editable field note. There is no chat feed, account, hosted inference API, geolocation, or species-identification claim.

## Try the loop

1. Open the app in a recent Chromium browser, preferably with WebGPU. Download Gemma on Wi-Fi once; allow roughly 900 MB of storage/downloads and sufficient free memory.
2. Choose your place, a nearby detail, duration, and noticing style. Make three missions using Gemma.
3. Start, lock the phone, and spend the time outside. A seated outdoor pause counts too. Stay on safe, familiar paths.
4. Tap “I'm back.” Timing stops **before** you write notes. Add a line or optional photo to each observation.
5. Choose an AI draft or your exact words. Review/edit the result, save it to the local journal, and export a note or evidence JSON.

The explicit **Preset card** option works without downloading the model. It is never labelled as AI. Model failures do not silently switch engines.

## Develop

Requires Node 22 and npm. From this directory:

```sh
npm ci
npm run build
npm run dev
```

Open `http://127.0.0.1:4173`. Build first: the worker and ONNX runtime assets are generated, not committed. HTTPS or localhost is required for service workers/WebGPU; opening the HTML as a file is not supported. `dist/` contains the authored static UI as well as generated assets—do not empty it as a build-cleanup step.

## Verify

```sh
npm test
npx playwright install chromium
npm run test:browser
# With the local server running; downloads real model weights on first use:
npm run test:model
```

On this Mac the browser tests use installed Brave. Elsewhere set `POCKET_WILD_BROWSER` to your Chromium executable. The model probe uses an isolated persistent browser profile (`POCKET_WILD_PROFILE`) and saves its measured results under `artifacts/`; it never uses your personal browser profile. Ordinary browser tests do not download a model. Real-model and outdoor checks are separate; see [testing](docs/testing.md).

## AI architecture

`setup → Gemma field card → phone away → observations → Gemma draft → local journal`

- Open-weight [Gemma 3 1B instruction model](https://huggingface.co/onnx-community/gemma-3-1b-it-ONNX), pinned to `a58439f40017d3b99c7d378ff525e54e0ba08ebf`.
- Transformers.js **4.3.0**, pinned dependencies in `package-lock.json`; ONNX Runtime Web bundled locally. No inference CDN script is loaded.
- The runtime binary is packaged as four pieces of at most 8 MiB to fit the preview host's 25 MiB per-file limit. The worker reassembles it and verifies SHA-256 before loading; the service worker caches every piece for offline use. Builds reject any oversized deployment asset.
- Dedicated web worker, WebGPU when available (`q4f16` on compatible GPUs, otherwise `q4`); a CPU/WASM path is implemented but needs device-specific verification.
- Weights are fetched directly from Hugging Face with download consent and cached by Transformers.js. Service-worker storage contains the app and runtime, not the remote weights.
- Experimental, pinned Transformers.js structured-output decoding enforces three JSON mission fields; imperative language, duplicate, and basic unsafe-action checks run afterwards. These are guardrails, not a safety guarantee. A rejected card stays rejected.
- Per-generation evidence: model/revision, backend, quantization, load time, first visible streamed chunk, elapsed inference time, connection flag, and unedited output. This is not Sentry tracing or an exact token count.

The smaller 270M model ran, but produced invented scenery and unreliable reflections in our fixtures. The project uses 1B for better instruction following, accepting a larger first download. See [model selection](docs/model-selection.md).

## Privacy and limitations

Walks, draft text, and downsampled JPEG photo blobs are saved in **IndexedDB on this device**, with up to 30 completed entries. Photos are not sent to Gemma; this model is text-only. Exported evidence deliberately omits photo bytes. There is no telemetry. Hosting/model providers still receive normal asset-download requests, but not observation prompts.

App-hidden time uses Page Visibility. It is **not** GPS-verified outdoor time, phone-wide screen time, or proof that someone walked. Browsers may evict storage; export important notes. This journal is local storage, not encrypted storage or cloud backup. Clearing site data deletes the journal and cached model. Device-local voice reading depends on an installed English speech pack.

Small models can still invent details. Original observations are preserved separately, and every AI reflection can be edited. Older phones may not have enough memory; use the clearly labelled preset option. Closing the tab stops in-memory model execution, but drafts survive when browser storage works. [Testing](docs/testing.md) distinguishes measured results from untested platforms.

## Deploy and submit

[Deployment instructions](docs/deployment.md) cover a public Render Static Site using `render.yaml`. Only claim the Render category after that deployment actually succeeds. The existing Sites preview is private and is not a judge-accessible public demo.

[Submission checklist](docs/submission-checklist.md), [DEV draft](docs/dev-submission.md), and [demo script](docs/demo-script.md) are included. The draft contains clearly marked fields for public links and **your real outdoor results**; do not publish it unchanged. Challenge code began on October 5, 2026. Any changes after the deadline must be documented here.

## License and acknowledgements

Application code is MIT licensed. Gemma is **open-weight under Google's Gemma terms**, not relicensed by this repository. Its weights are not included here. See [third-party notices](THIRD_PARTY_NOTICES.md) for the runtime, model export, and upstream licences. AI-assisted implementation used Codex; that does not imply GitHub Copilot was used.

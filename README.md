# Pocket Wild

Three things to notice. Then put your phone away.

[Open Pocket Wild](https://pocket-wild.onrender.com/) · [Public source](https://github.com/sneaxhuh/pocket-wild)

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

On this Mac the ordinary browser tests use installed Brave. The model probe prefers Playwright's installed Chromium build, falling back to Brave when it is unavailable. Set `POCKET_WILD_BROWSER` to override the executable. The model probe uses an isolated persistent browser profile (`POCKET_WILD_PROFILE`) and saves its measured results under `artifacts/`; it never uses your personal browser profile. Ordinary browser tests do not download a model. Real-model and outdoor checks are separate.

To run the same real-model probe against the public deployment, set `POCKET_WILD_URL=https://pocket-wild.onrender.com/` before `npm run test:model`. The report records the tested origin. Model storage is origin-specific, so the first hosted-origin test downloads the weights again.

Recorded verification on October 6, 2026: 11 unit checks and nine browser checks against the public deployment passed. On an Apple Silicon Mac using Brave/Chromium 154, WebGPU, and `q4f16`, three contextual cards took 0.825 / 0.814 / 0.890 seconds. After an offline reload, cached model loading took 1.652 seconds and a new card took 0.886 seconds. The full offline Gemma flow, evidence export, and journal restoration passed in the recorded run. These are automated indoor fixtures, not outdoor observations or phone benchmarks. Phone, Safari, and CPU/WASM behaviour still require device-specific verification.

## AI architecture

`setup → Gemma field card → phone away → observations → Gemma draft → local journal`

- Open-weight [Gemma 3 1B instruction model](https://huggingface.co/onnx-community/gemma-3-1b-it-ONNX), pinned to `a58439f40017d3b99c7d378ff525e54e0ba08ebf`.
- Transformers.js **4.3.0**, pinned dependencies in `package-lock.json`; ONNX Runtime Web bundled locally. No inference CDN script is loaded.
- The runtime binary is packaged as four pieces of at most 8 MiB to fit the preview host's 25 MiB per-file limit. The worker reassembles it and verifies SHA-256 before loading; the service worker caches every piece for offline use. Builds reject any oversized deployment asset.
- Dedicated web worker, WebGPU when available (`q4f16` on compatible GPUs, otherwise `q4`); a CPU/WASM path is implemented but needs device-specific verification.
- Weights are fetched directly from Hugging Face with download consent and cached by Transformers.js. Service-worker storage contains the app and runtime, not the remote weights.
- Experimental, pinned Transformers.js structured-output decoding enforces three JSON mission fields; imperative language, duplicate, and basic unsafe-action checks run afterwards. These are guardrails, not a safety guarantee. A rejected card stays rejected.
- Per-generation evidence: model/revision, backend, quantization, load time, first visible streamed chunk, elapsed inference time, connection flag, and unedited output. This is not Sentry tracing or an exact token count.

The smaller 270M model ran, but produced invented scenery and unreliable reflections in our fixtures. The project uses 1B for better instruction following, accepting a larger first download.

## Privacy and limitations

Walks, draft text, and downsampled JPEG photo blobs are saved in **IndexedDB on this device**, with up to 30 completed entries. Photos are not sent to Gemma; this model is text-only. Exported evidence deliberately omits photo bytes. There is no telemetry. Hosting/model providers still receive normal asset-download requests, but not observation prompts.

App-hidden time uses Page Visibility. It is **not** GPS-verified outdoor time, phone-wide screen time, or proof that someone walked. Browsers may evict storage; export important notes. This journal is local storage, not encrypted storage or cloud backup. Clearing site data deletes the journal and cached model. Device-local voice reading depends on an installed English speech pack.

Small models can still invent details. Original observations are preserved separately, and every AI reflection can be edited. Older phones may not have enough memory; use the clearly labelled preset option. Closing the tab stops in-memory model execution, but drafts survive when browser storage works. The verification section above distinguishes measured results from untested platforms.

## Deploy and submit

[The public Render app](https://pocket-wild.onrender.com/) is deployed from this repository's `main` branch as a Static Site: build `npm ci && npm test && npm run build`, publish `dist`, Node `22.21.0`, and `SKIP_INSTALL_DEPS=true`. The alternative `render.yaml` Blueprint is included. The current directly created service deploys on commits and runs unit checks in its build; GitHub Actions runs additional browser checks separately. The separate Sites preview remains private; use the public Render link for judging.

[Watch the demo](https://youtu.be/aYSvRs5FjMQ). Submission drafts and supporting documents are maintained locally, not in the public repository. Challenge code began on October 5, 2026. Any changes after the deadline must be documented here.

## License and acknowledgements

Application code is MIT licensed. Gemma is **open-weight under Google's Gemma terms**, not relicensed by this repository. Its weights are not included here. See [third-party notices](THIRD_PARTY_NOTICES.md) for the runtime, model export, and upstream licences. AI-assisted implementation used Codex; that does not imply GitHub Copilot was used.

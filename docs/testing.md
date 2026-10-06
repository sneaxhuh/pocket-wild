# Verification

Automated test fixtures are not outdoor field results. This document separates functional checks, real inference, and checks the submitter still needs to perform.

## Functional tests

`npm test` covers timing freeze, visibility snapshots/reload, finite zero-duration metrics, field-card parsing/unsafe-action rejection, configuration validation, and photo-free evidence export. Runtime tests cover exact reassembly, SHA-256 corruption detection, missing pieces, invalid manifest paths/lengths, and the 25 MiB deployment-file limit.

`npm run test:browser` exercises the complete preset walk, saved observation drafts and journal reload, downloads (including parsing an evidence JSON download while offline), offline shell reload, exact reconstruction of all four cached runtime pieces without network, explicit engine readiness, viewport widths 320/390/840/1280, keyboard controls, and the WebMCP handler's input contract. The WebMCP test simulates the host API; it does not prove integration with an actual external agent host. Set `POCKET_WILD_URL` to target a hosted app without starting the local server. Hosted tests allow 120 seconds rather than the local 30 seconds because each isolated context downloads a fresh 27 MB offline runtime before checking offline readiness.

## Real inference

`npm run test:model` uses actual Gemma weights and an isolated Chromium profile. It generates three context-specific cards, a reflection from clearly identified fixtures, a warm offline card, and a cold offline app reload/model load/card. The report is `artifacts/runtime-results.json` and includes full outputs and measured timings. It is ignored by Git by default to avoid publishing accidental private observations; review before attaching it to the submission.

Local packaging verification measured October 6, 2026 IST on an Apple Silicon Mac, installed Brave/Chromium 154, WebGPU, `q4f16`. That real-model run passed with zero browser errors and zero failed requests:

| Check | Measured result |
| --- | --- |
| Unit checks | 11 passed |
| Browser checks | 8 passed, including stored photos, edited notes, confirmed draft discard, and offline runtime reconstruction |
| Three contextual cards | 0.762 / 0.821 / 0.868 seconds |
| Fixture reflection | 0.538 seconds |
| Warm offline card | 0.709 seconds |
| Cold offline model load | 1.476 seconds from cache |
| Card after cold offline reload | 0.880 seconds |
| Full offline Gemma UI + evidence download + journal reload | Passed |

The [reviewed local runtime report](runtime-evidence.json) preserves actual fixture inputs, full outputs, connection flags, and timings. Cached-load timings exclude the first model download; the initial 1B download/load during development took about 35 seconds on this connection. This is a small functional/qualitative sample, not a performance benchmark across hardware. No phone, Safari, CPU/WASM, or outdoor test is implied; the separate production-host check is below.

These results use the deployment-compatible four-piece runtime, with its verified SHA-256 fingerprint recorded in model/generation evidence. The 8 MiB largest asset is below the preview host's 25 MiB per-file limit. The model probe explicitly waits for the evidence download to finish before opening its stream; a failed download fails verification.

## Public Render verification

The [public app](https://pocket-wild.onrender.com/) was checked on October 6, 2026 in an isolated, signed-out Brave/Chromium 154 profile on the same Mac. The root returned HTTP 200, the runtime module was served as JavaScript, and its four-piece runtime matched the local SHA-256 fingerprint. The [initial GitHub Actions run](https://github.com/sneaxhuh/pocket-wild/actions/runs/37437929577) passed; Render's deployment of source commit `d908fd835f06fc11daea3f1de4769855d3405023` reached `live`.

The [reviewed hosted report](render-runtime-evidence.json) records the tested public origin, supplied fixtures, complete outputs, and zero browser errors or failed requests in the final successful run:

| Hosted check | Measured result |
| --- | --- |
| Browser suite against the public app | 9 passed, including offline runtime reconstruction, export, photos, and the simulated agent handler |
| Three contextual cards | 0.825 / 0.814 / 0.890 seconds |
| Fixture reflection | 0.550 seconds |
| Warm offline card | 0.711 seconds |
| Cold offline model load | 1.652 seconds from cache |
| Card after cold offline reload | 0.886 seconds |
| Full offline Gemma UI, evidence JSON download, journal reload | Passed |

These are automated indoor fixtures, not an outdoor walk or phone test. The first download/load on this origin took about 95 seconds in an earlier run; that run did not complete the final export check. Earlier persistent Brave probe runs exited with a native `SIGSEGV` during export. The final run reused the persistent context's primary page and completed, and a separate fresh-context offline export regression also passed. This does not establish the native crash's root cause or guarantee every browser/device.

## Offline and decoding bugs caught by real testing

The 4.3 runtime's file enumeration probes `main` even with revision options, causing an uncached tokenizer metadata request after an offline restart. The worker loads tokenizer/model components directly and also pins the Hub URL template, so metadata and cache keys use the same immutable revision. No mutable `main` cache aliases are fabricated.

Constrained JSON generation enforces the three mission fields during decoding. The export's tokenizer has an extra token beyond the model's logits vocabulary; a small, tested grammar-only adapter excludes unreachable tokens without altering prompt encoding/output decoding. The structured-output helper is experimental and pinned; basic content/risk checks still run after decoding.

Output quality is not perfect: the report includes “mossy stones” that the fixture did not name, and the reflection added a “single” call. Missions are prompts, not verified scene descriptions. The UI says to use only what is present and skip what does not fit; reflections remain reviewable and editable. No hallucination-free claim is made.

## Still requires manual verification

- A human check of the public deployment in a signed-out browser (automated verification is recorded above).
- Model download, cached reload, and airplane-mode generation on the intended phone/browser.
- Real ten-minute outdoor/seated test and field-note review.
- Photo capture on the actual phone; image codec/camera behaviour varies.
- Optional local speech with a downloaded voice.

Use [the checklist](submission-checklist.md), including the real field test. Report unsupported devices honestly; do not turn a preset result into “offline Gemma” evidence.

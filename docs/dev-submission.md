---
title: "Pocket Wild: three things to notice, then put your phone away"
published: false
tags: devchallenge, hf26challenge, ai, webdev
---

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 1: Touch Grass](https://dev.to/challenges/hacktoberfest-week1-2026-10-05).*

<!-- DRAFT: replace all TODOs and remove this note before publishing. Nothing below asserts an outdoor test has already happened. -->

## What I Built

Most AI interfaces invite another message. I wanted this one to end with the phone in my pocket.

**Pocket Wild** makes three short nature-noticing missions from your surroundings: a garden, a park, a familiar trail, or the trees on your street. Read the card, start a 10-, 20-, or 30-minute pause, then lock the phone. A seated outdoor pause counts too.

When you return, write what you actually noticed. Gemma can turn those observations into an editable field note, or you can keep your exact words. Notes and optional photographs stay in a local field journal. No account, map, feed, leaderboard, or species-identification promises.

### Taking it outside

TODO: Write 120–180 words in your own voice about your real test: where you safely used it, device/browser, duration, the missions, one detail you would otherwise have missed, whether you kept the phone away, and one thing that did not work. Add your actual photo and exported timing figures. Explain that “away” means this app was hidden, not verified outdoor time or phone-wide screen time.

## Demo

Public app: [Pocket Wild on Render](https://pocket-wild.onrender.com/).

TODO: Add a 60–90 second demo video. Demonstrate airplane mode **after reloading**, not just a model that was already in memory. Add screenshots of a real Gemma card and a field note, avoiding private information.

## Code

[Public GitHub repository](https://github.com/sneaxhuh/pocket-wild). Application code is MIT licensed; Gemma retains its own model terms. See the [testing report](https://github.com/sneaxhuh/pocket-wild/blob/main/docs/testing.md) and [third-party notices](https://github.com/sneaxhuh/pocket-wild/blob/main/THIRD_PARTY_NOTICES.md).

## How I Built It

The interface is plain HTML, CSS, and JavaScript. A dedicated worker runs [Gemma 3 1B's ONNX export](https://huggingface.co/onnx-community/gemma-3-1b-it-ONNX) through Transformers.js 4.3.0 and ONNX Runtime Web. Model revision and dependency versions are pinned. On the tested Mac it uses WebGPU and four-bit weights. The first download is substantial; subsequent generation happens locally.

A service worker saves the app **and** its inference runtime. Transformers.js caches the model separately. That distinction matters: cached weights alone do not make an app offline if its JavaScript still depends on an uncached CDN.

IndexedDB saves the active draft and up to 30 completed walks, including local photo blobs. Photos are journal attachments, not model inputs. The walk ends when I tap “I'm back,” before note-taking. Every exported evidence file includes the engine, model revision, backend, quantization, inference duration, first streamed output timing, raw output, and connection flag.

### Two problems worth fixing

The first model failed to load. Its newer quantized ONNX export used an operator attribute the older runtime did not support. Updating the runtime solved that startup bug—but did not solve output quality.

The 270M model then ran quickly, yet invented scenery and expanded three observations into unsupported weather and sensations. I switched to 1B and tightened the field-card format and validation. This costs more download/storage, but the test cases produced more relevant instructions and a much more restrained reflection. It is still a small model, so original observations remain visible in the evidence and the reflection is editable.

On the public Render deployment, three contextual cards took 0.825 / 0.814 / 0.890 seconds on the tested Mac. A fixture reflection took 0.550 seconds. With the browser offline, reloading the app and loading the model from cache took 1.652 seconds, followed by a new card in 0.886 seconds. The full offline UI flow, exported evidence, and journal reload passed with no browser errors or failed requests. These are automated indoor fixtures, not outdoor observations; they are not phone performance claims. The first download remains the slower part.

I also used constrained JSON decoding to enforce exactly three mission fields. That exposed a tokenizer/logits vocabulary mismatch, fixed with a grammar-only adapter. A cold offline test caught a separate metadata request to the mutable `main` branch; pinning the URL template as well as the model options removed it. The [testing notes and reviewed evidence](https://github.com/sneaxhuh/pocket-wild/blob/main/docs/testing.md) show both the fixes and the remaining output limitations.

The preset engine is a separate, explicitly chosen option for incompatible devices—not a hidden substitute presented as AI. Rejected model cards do not silently become preset cards.

## Why Does Open Innovation Matter?

The open-weight model lets inference go outside with the person, without needing a hosted endpoint to read their observations. Once the app and model are cached, the tested offline path needs neither network coverage nor an inference API key.

The open-source runtime also made the failure inspectable. I could trace the model/runtime mismatch, change the pinned pairing, test another model size, and keep the entire inference path on the device. Another builder can change the prompts, swap an export, or improve the validators without rebuilding a remote service.

There are trade-offs: the first download is large, browser storage can be evicted, GPU support varies, and Gemma's licence is its own open-weight licence rather than this repository's MIT licence. Local inference is not magic privacy either: the journal is not encrypted and the initial asset providers see normal download requests. Those constraints are documented instead of hidden behind “offline-first.”

## My Agent Session

I used Codex to help implement and test the project. TODO: Optionally add a reviewed DevRelay/session link; remove this section if you do not share a session. Never expose credentials or private browser data.

## Prize Categories

- **Best Use of Gemma:** Gemma generates the field card and the observation-based draft locally; the evidence records actual inference.
- **Best Use of Render:** the public front end is a live Render Static Site built from the public GitHub repository. It serves the complete offline app and inference runtime; no hosted inference server is needed.
- **Best Use of GitHub Copilot (GitHub Actions criterion):** the repository's Actions workflow has actually passed unit, build, and browser checks. This describes Actions usage under the challenge's published criterion, not Copilot-generated code; Codex helped build the project.

TODO: Credit any human teammates by DEV handle. Review the article, replace every TODO, and publish with the required challenge tags before the deadline.

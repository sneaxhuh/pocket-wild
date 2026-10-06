# Third-party notices

The application code's MIT licence does not replace upstream licences.

- **Gemma 3**, Google: open weights under the [Gemma Terms of Use](https://ai.google.dev/gemma/terms) and [prohibited-use policy](https://ai.google.dev/gemma/prohibited_use_policy). Model weights are downloaded from the upstream repository, not distributed in this source tree. Use of the model is subject to its terms.
- **Gemma ONNX export**, [ONNX Community](https://huggingface.co/onnx-community/gemma-3-1b-it-ONNX): credited for the conversion used by the browser. This is a community export, not an original training or fine-tuning by this project.
- **Transformers.js** and its experimental **structured-output helper**, Hugging Face: Apache-2.0. [Source and licence](https://github.com/huggingface/transformers.js).
- **ONNX Runtime**, Microsoft: MIT. [Source and licence](https://github.com/microsoft/onnxruntime).
- Other runtime dependencies retain their licences and notices from the locked npm packages. The build copies runtime licence texts into `dist/vendor/licenses/` and emits bundled code notices in `dist/model-worker.js.LEGAL.txt`.
- **esbuild** (MIT) and **Playwright** (Apache-2.0) are build/test tools, not product AI engines.

Pocket Wild's design, field cards, workflow, tests, and prose were created for this challenge with Codex assistance. No generated test fixture or screenshot is represented as evidence of an actual outdoor walk.

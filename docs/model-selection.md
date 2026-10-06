# Why Gemma 3 1B

The initial 270M prototype optimised download size, not verified output quality. Real browser inference showed a problem that a mock test could not: instructions became descriptive claims about imaginary scenery, while reflections invented weather, fruit, and sensations absent from the observations.

The actual fixture was a crow calling from a mango tree, orange marigolds, and a shadow crossing a stone bench. The 270M output added humid air, ripe fruit, and plastic rings. Its offline field card also failed validation. We did not present this as a successful AI demo.

Gemma 3 1B is a larger download: about 763 MB of `q4f16` external weights, or 859 MB for `q4`, plus tokenizer/configuration and locally bundled runtime files. Its first tested fixture retained the crow, marigolds, and bench in a short paragraph instead of the 270M elaboration. It still changed “called” into “a single call,” so reflection review remains necessary. This is a limited qualitative test, not a benchmark or a claim that hallucinations are eliminated.

The shipping approach combines a pinned 1B model, tightly framed prompts, strict card shape/duplicate/basic-risk checks, original observations, editable drafts, and explicit non-AI choices. No fine-tuning is claimed. Final measured cards and timings belong in the reviewed runtime report and `testing.md`.

The trade-off is explicit: stronger local instruction following versus first-download size and memory requirements. Recent WebGPU browsers are the primary tested path; unsupported devices can use the labelled preset engine.

// The Gemma export has an added tokenizer token beyond the model's logits.
// Constrained decoding must mask only tokens the model can actually emit.
// This adapter never changes the tokenizer used to encode prompts or decode output.
export function grammarTokenizerFor(tokenizer, vocabSize) {
  if (!Number.isInteger(vocabSize) || vocabSize <= 0) throw new Error('The model has no valid vocabulary size.');
  const vocabulary = tokenizer.get_vocab();
  const entries = vocabulary instanceof Map ? [...vocabulary] : Object.entries(vocabulary);
  const vocab = Object.fromEntries(entries.filter(([, id]) => id >= 0 && id < vocabSize));
  const json = tokenizer._tokenizerJSON;
  const eos = tokenizer.eos_token_id;
  if (!json || !Number.isInteger(eos) || eos >= vocabSize) throw new Error('The grammar tokenizer is incompatible with this model.');
  return {
    _tokenizerJSON: { ...json, model: { ...json.model, vocab }, added_tokens: (json.added_tokens || []).filter(token => token.id < vocabSize) },
    eos_token_id: eos,
    all_special_ids: (tokenizer.all_special_ids || []).filter(id => id < vocabSize),
    decode: tokenizer.decode.bind(tokenizer),
  };
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { validateConfig, fallbackMissions, parseMissions, createWalk, startWalk, finishWalk, updateVisibility, walkMetrics, snapshotWalk, exportWalk } from '../dist/core.js';
import { grammarTokenizerFor } from '../src/grammar-tokenizer.js';

const config = { duration: 10, mood: 'quiet', place: 'park', context: 'A bench and trees' };
const newWalk = () => createWalk(config, fallbackMissions(config), { engine: 'preset' }, 1000, 'test-walk');

test('walk duration freezes on return and excludes later note writing', () => {
  const walk = newWalk(); startWalk(walk, 1000); updateVisibility(walk, false, 6000); updateVisibility(walk, true, 601000); finishWalk(walk, 611000);
  assert.deepEqual(walkMetrics(walk, 2000000), { elapsedMs: 610000, visibleMs: 15000, awayMs: 595000, awayPercent: 98 });
});
test('a restored draft does not count a hidden interval as visible', () => {
  const walk = newWalk(); startWalk(walk, 1000); const saved = snapshotWalk(walk, 6000);
  assert.equal(saved.visibleSince, null); assert.equal(walk.visibleSince, 1000);
  updateVisibility(saved, true, 100000); finishWalk(saved, 105000);
  assert.equal(walkMetrics(saved).visibleMs, 10000);
});
test('zero duration yields a finite metric rather than fabricated screen time', () => {
  const walk = newWalk(); startWalk(walk, 1000); finishWalk(walk, 1000);
  assert.deepEqual(walkMetrics(walk), { elapsedMs: 0, visibleMs: 0, awayMs: 0, awayPercent: 0 });
});
test('three output lines are required; unsafe or repeated missions are rejected', () => {
  const missions = parseMissions('1. Listen for a nearby sound and a distant sound.\n2. Find two shades of green in a tree.\n3. Notice the edge of a shadow.');
  assert.equal(missions.length, 3);
  assert.throws(() => parseMissions('1. Eat a leaf from the tree.\n2. Notice the sky above you.\n3. Find a repeating natural pattern.'));
  assert.throws(() => parseMissions('1. Notice the sky above you.\n2. Notice the sky above you.\n3. Notice the sky above you.'));
  assert.throws(() => parseMissions('1. Notice the sky above you.'));
  assert.equal(parseMissions(JSON.stringify({ listen: 'Listen for a nearby sound.', look: 'Look for a pattern on a leaf.', watch: 'Watch the edge of a shadow.' })).length, 3);
  assert.throws(() => parseMissions(JSON.stringify({ listen: 'A gentle breeze is blowing.', look: 'Look for a pattern on a leaf.', watch: 'Watch the edge of a shadow.' })));
  assert.throws(() => parseMissions('1. Touch the leaves of a tree.\n2. Look for a nearby pattern.\n3. Watch a shadow on the path.'));
});
test('grammar vocabulary excludes added tokens the model cannot emit, without mutating the tokenizer', () => {
  const raw = { model: { vocab: { a: 0, end: 1, extra: 2 } }, added_tokens: [{ id: 2, content: 'extra' }] };
  const tokenizer = { _tokenizerJSON: raw, get_vocab: () => new Map([['a', 0], ['end', 1], ['extra', 2]]), eos_token_id: 1, all_special_ids: [1, 2], decode: () => 'a' };
  const adapter = grammarTokenizerFor(tokenizer, 2);
  assert.deepEqual(adapter._tokenizerJSON.model.vocab, { a: 0, end: 1 });
  assert.equal(adapter._tokenizerJSON.added_tokens.length, 0);
  assert.deepEqual(adapter.all_special_ids, [1]);
  assert.equal(raw.added_tokens.length, 1);
  assert.throws(() => grammarTokenizerFor(tokenizer, 1));
});
test('configuration validates the same choices the UI exposes', () => {
  assert.equal(validateConfig(config).duration, 10);
  assert.throws(() => validateConfig({ ...config, duration: 2 }));
  assert.throws(() => validateConfig({ ...config, mood: 'undefined' }));
});
test('evidence reports actual engine and excludes photo bytes', () => {
  const walk = newWalk(); walk.observations[0].photo = new Blob(['private image']);
  const evidence = exportWalk(walk);
  assert.equal(evidence.missionProvenance.engine, 'preset');
  assert.deepEqual(evidence.observations[0], { text: '', hasPhoto: true });
  assert.match(evidence.measurements.definition, /not proof/);
});

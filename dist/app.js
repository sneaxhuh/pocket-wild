import { createWalk, validateConfig, fallbackMissions, fallbackReflection, startWalk, finishWalk, updateVisibility, walkMetrics, snapshotWalk, formatTime, exportWalk } from './core.js';
import { LocalGemma } from './gemma.js';
import { localStore } from './storage.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const gemma = new LocalGemma();
let walk = null;
let journal = [];
let busy = false;
let saveQueue = Promise.resolve();
let photoURLs = [];
let refreshTimer;
let registration;
const dateFormat = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' });

function message(text, isError = false) {
  $('#app-message').textContent = text;
  $('#app-message').hidden = !text;
  $('#app-message').classList.toggle('error', isError);
}

function setBusy(value, text = '') {
  busy = value;
  $('#operation').hidden = !value;
  $('#operation-label').textContent = text;
  $$('button[data-block-busy], #walk-form button[type="submit"], #observation-form button[type="submit"], #load-gemma, #home-button, #save-edit, #journal-open, [data-action="home"], #discard-draft, #resume-walk').forEach(button => { button.disabled = value; });
  $('#cancel-model').hidden = !value;
}

function saveDraft() {
  if (!walk) return Promise.resolve();
  const snapshot = snapshotWalk(walk);
  saveQueue = saveQueue.catch(() => {}).then(() => localStore.put('draft', snapshot)).catch(() => {
    message('This browser could not save your walk. Keep this tab open and download your note before leaving.', true);
  });
  return saveQueue;
}

function showScreen(name, focus = true) {
  $$('.screen').forEach(screen => { screen.hidden = screen.id !== `screen-${name}`; });
  $('#home-button').disabled = busy;
  if (focus) {
    window.scrollTo({ top: 0 });
    const heading = $(`#screen-${name} h1, #screen-${name} h2`);
    heading?.focus({ preventScroll: true });
  }
  clearInterval(refreshTimer);
  if (name === 'walk') {
    updateTimer();
    refreshTimer = setInterval(updateTimer, 1000);
  }
  $('#resume-panel').hidden = !walk || walk.phase === 'summary' || name !== 'setup';
}

function sourceLabel(provenance) {
  if (provenance?.engine === 'gemma') return `Gemma · on this device · ${(provenance.durationMs / 1000).toFixed(1)}s`;
  return 'Preset card · no AI generation';
}

function renderMissions() {
  const list = $('#mission-list');
  list.replaceChildren();
  walk.missions.forEach((mission, index) => {
    const fragment = $('#mission-template').content.cloneNode(true);
    $('.mission-index', fragment).textContent = `0${index + 1}`;
    $('.mission-sense', fragment).textContent = mission.sense;
    $('.mission-text', fragment).textContent = mission.text;
    list.append(fragment);
  });
  $('#mission-duration').textContent = `${walk.config.duration} MIN / ${walk.config.place.toUpperCase()}`;
  $('#mission-source').textContent = sourceLabel(walk.missionProvenance);
  $('#pocket-card').replaceChildren();
  for (const mission of walk.missions) {
    const item = document.createElement('li'); item.textContent = mission.text; $('#pocket-card').append(item);
  }
}

function updateTimer() {
  if (!walk || walk.phase !== 'walk') return;
  const remaining = walk.startedAt + walk.config.duration * 60000 - Date.now();
  $('#walk-timer').textContent = formatTime(remaining);
  $('#walk-timer').setAttribute('aria-label', `${Math.max(0, Math.ceil(remaining / 60000))} minutes remaining`);
  $('#walk-sub').textContent = remaining <= 0 ? 'Your time is yours. Return whenever you are ready.' : 'Lock your phone. Your walk keeps time while this app is away.';
}

async function photoBlob(file) {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.');
  if (file.size > 20 * 1024 * 1024) throw new Error('Choose a photo smaller than 20 MB.');
  const image = await createImageBitmap(file);
  const ratio = Math.min(1, 1200 / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * ratio)); canvas.height = Math.max(1, Math.round(image.height * ratio));
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height); image.close();
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('The photo could not be saved.')), 'image/jpeg', .8));
}

function releasePhotos() { photoURLs.forEach(url => URL.revokeObjectURL(url)); photoURLs = []; }

function renderObservations() {
  releasePhotos();
  const form = $('#observation-form'); form.replaceChildren();
  walk.missions.forEach((mission, index) => {
    const fragment = $('#observation-template').content.cloneNode(true);
    $('legend', fragment).textContent = `0${index + 1} / ${mission.sense}`;
    $('.observation-prompt', fragment).textContent = mission.text;
    const textarea = $('textarea', fragment);
    textarea.name = `observation-${index}`; textarea.value = walk.observations[index].text;
    textarea.setAttribute('aria-label', `Observation ${index + 1}`);
    textarea.addEventListener('input', () => { walk.observations[index].text = textarea.value; void saveDraft(); });
    const file = $('input[type="file"]', fragment); file.setAttribute('aria-label', `Photo for observation ${index + 1}`);
    const preview = $('.photo-preview', fragment);
    const displayPhoto = blob => {
      const url = URL.createObjectURL(blob); photoURLs.push(url);
      preview.src = url; preview.hidden = false;
    };
    if (walk.observations[index].photo) displayPhoto(walk.observations[index].photo);
    file.addEventListener('change', async () => {
      if (!file.files?.[0]) return;
      try { const blob = await photoBlob(file.files[0]); walk.observations[index].photo = blob; displayPhoto(blob); await saveDraft(); }
      catch (error) { message(error.message, true); }
    });
    form.append(fragment);
  });
  const submit = document.createElement('button'); submit.className = 'primary-action'; submit.type = 'submit';
  submit.innerHTML = '<span>MAKE MY FIELD NOTE</span><span class="action-icon" aria-hidden="true">✦</span>';
  form.append(submit);
  $('#note-engine').value = gemma.info ? 'gemma' : 'verbatim';
}

function renderSummary() {
  releasePhotos();
  const metrics = walkMetrics(walk);
  $('#outside-stat').textContent = formatTime(metrics.elapsedMs);
  $('#screen-stat').textContent = formatTime(metrics.visibleMs);
  $('#ratio-stat').textContent = `${metrics.awayPercent}%`;
  $('#summary-date').textContent = dateFormat.format(walk.createdAt).toUpperCase();
  $('#field-note-copy').textContent = walk.fieldNote;
  $('#note-source').textContent = sourceLabel(walk.noteProvenance).replace('Preset card · no AI generation', 'Your exact observations · no AI rewrite');
  $('#summary-photos').replaceChildren();
  walk.observations.filter(o => o.photo).forEach((observation, index) => {
    const image = document.createElement('img'); const url = URL.createObjectURL(observation.photo); photoURLs.push(url);
    image.src = url; image.alt = observation.text || `Your field photograph ${index + 1}`; $('#summary-photos').append(image);
  });
  $('#reflection-warning').hidden = walk.noteProvenance?.engine !== 'gemma';
  $('#edit-note').value = walk.fieldNote;
  $('#evidence-details').textContent = JSON.stringify({ missions: walk.missionProvenance, reflection: walk.noteProvenance, measurements: exportWalk(walk).measurements }, null, 2);
}

function restoreWalk() {
  if (!walk) return;
  renderMissions();
  if (walk.phase === 'walk') updateVisibility(walk, document.visibilityState === 'visible');
  if (walk.phase === 'observe') renderObservations();
  if (walk.phase === 'summary') renderSummary();
  showScreen(walk.phase === 'missions' ? 'missions' : walk.phase);
}

async function loadGemma() {
  setBusy(true, 'Preparing Gemma on your device…'); message('');
  const progress = $('#model-progress'); progress.hidden = false;
  try {
    await navigator.storage?.persist?.();
    const info = await gemma.load(data => { if (Number.isFinite(data.progress)) progress.value = data.progress; $('#model-status').textContent = data.message; });
    $('#model-title').textContent = 'Gemma is ready';
    $('#model-status').textContent = `Runs on your ${info.backend === 'webgpu' ? 'GPU' : 'CPU'}. Downloaded weights stay in this browser.`;
    $('#load-gemma').textContent = 'MODEL LOADED';
    $('#engine-gemma').checked = true;
    $('#engine-note').textContent = 'Gemma runs here. Your surroundings and observations stay on this device.';
    progress.value = 100;
    await localStore.put('model-loaded', true);
    message('Gemma is ready. Make a walk, or test it after disconnecting.');
  } catch (error) {
    $('#model-title').textContent = 'Model unavailable';
    $('#model-status').textContent = error.message;
    $('#load-gemma').textContent = 'RETRY DOWNLOAD';
    progress.hidden = true;
    message('Your walk is safe. Retry the model or explicitly choose a preset card.', true);
  } finally { setBusy(false); }
}

async function prepareWalk(config, engine) {
  config = validateConfig(config);
  if (engine === 'gemma' && !gemma.info) throw new Error('Load Gemma above first, or choose “Preset card”.');
  if (walk && walk.phase !== 'summary') throw new Error('Resume your saved walk first, or finish it before making a new one.');
  setBusy(true, engine === 'gemma' ? 'Gemma is making three things to notice…' : 'Preparing your field card…');
  try {
    const result = engine === 'gemma' ? await gemma.missions(config) : { missions: fallbackMissions(config), provenance: { engine: 'preset' } };
    walk = createWalk(config, result.missions, result.provenance);
    await saveDraft(); renderMissions(); showScreen('missions'); message('');
    return { duration: config.duration, missions: walk.missions, engine: walk.missionProvenance.engine };
  } finally { setBusy(false); }
}

async function saveToJournal() {
  const snapshot = snapshotWalk(walk);
  journal = [snapshot, ...journal.filter(entry => entry.id !== snapshot.id)].slice(0, 30);
  await localStore.put('journal', journal);
  await saveDraft();
  $('#journal-count').textContent = String(journal.length);
}

function download(content, type, name) {
  const link = document.createElement('a'); const url = URL.createObjectURL(new Blob([content], { type }));
  link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$('#walk-form').addEventListener('submit', async event => {
  event.preventDefault(); if (busy) return;
  const data = new FormData(event.currentTarget);
  try { await prepareWalk(Object.fromEntries(data), data.get('engine')); }
  catch (error) { message(error.message, true); }
});
$('#load-gemma').addEventListener('click', loadGemma);
$('#cancel-model').addEventListener('click', () => { gemma.cancel(); setBusy(false); $('#model-title').textContent = 'Model stopped'; $('#load-gemma').textContent = 'LOAD GEMMA'; message('Cancelled. Your draft is still saved.'); });
$('#begin-walk').addEventListener('click', () => { startWalk(walk, Date.now(), document.visibilityState === 'visible'); void saveDraft(); showScreen('walk'); });
$('#finish-walk').addEventListener('click', () => { finishWalk(walk); void saveDraft(); renderObservations(); showScreen('observe'); window.speechSynthesis?.cancel(); });
$('#resume-walk').addEventListener('click', restoreWalk);
$('#discard-draft').addEventListener('click', async () => {
  if (busy || !walk || walk.phase === 'summary' || !window.confirm('Discard this unfinished walk and its unsaved observations/photos? Completed journal entries will stay.')) return;
  try {
    await saveQueue;
    await localStore.delete('draft');
    walk = null; releasePhotos(); window.speechSynthesis?.cancel(); showScreen('setup');
    message('The unfinished walk was discarded. Completed journal entries are unchanged.');
  } catch { message('The draft could not be discarded. It is still available to resume.', true); }
});
$('#home-button').addEventListener('click', () => { if (busy) return; void saveDraft(); showScreen('setup'); });
$$('[data-action="home"]').forEach(button => button.addEventListener('click', () => { showScreen('setup'); message(''); }));

$('#read-card').addEventListener('click', () => {
  if (!('speechSynthesis' in window)) { $('#pocket-missions').open = true; message('Speech is unavailable here. Your written field card is below.'); return; }
  const voices = speechSynthesis.getVoices().filter(voice => voice.localService && voice.lang.startsWith('en'));
  if (!voices.length) { $('#pocket-missions').open = true; message('No downloaded English voice is available. Read the field card below.'); return; }
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(walk.missions.map((mission, index) => `Mission ${index + 1}. ${mission.text}`).join(' '));
  utterance.voice = voices[0]; utterance.rate = .9; speechSynthesis.speak(utterance);
});

$('#observation-form').addEventListener('submit', async event => {
  event.preventDefault(); if (busy) return;
  const engine = $('#note-engine').value;
  if (engine === 'gemma' && !gemma.info) { message('Load Gemma from the home screen, then resume this draft; or choose “Keep my exact words”.', true); return; }
  if (engine === 'gemma' && !walk.observations.some(o => o.text.trim())) { message('Add at least one observation so Gemma has real details to use.', true); return; }
  setBusy(true, engine === 'gemma' ? 'Gemma is reflecting on what you noticed…' : 'Saving your observations…');
  try {
    const note = engine === 'gemma' ? await gemma.reflect(walk) : { text: fallbackReflection(walk), provenance: { engine: 'verbatim' } };
    walk.fieldNote = note.text; walk.noteProvenance = note.provenance; walk.phase = 'summary';
    await saveToJournal(); renderSummary(); showScreen('summary'); message('Saved to the field journal on this device.');
  } catch (error) { walk.phase = 'observe'; message(`${error.message} Your draft is still available; retry or keep your exact words.`, true); }
  finally { setBusy(false); }
});

$('#save-edit').addEventListener('click', async () => {
  try { walk.fieldNote = $('#edit-note').value.trim() || walk.fieldNote; walk.noteProvenance = { ...walk.noteProvenance, editedByUser: true }; await saveToJournal(); renderSummary(); message('Your edit is saved locally.'); }
  catch { message('Your edit could not be saved. Download your note before closing this tab.', true); }
});
$('#download-note').addEventListener('click', () => {
  const metrics = walkMetrics(walk);
  const text = `POCKET WILD / ${dateFormat.format(walk.createdAt)}\n\n${walk.fieldNote}\n\nWalk: ${formatTime(metrics.elapsedMs)}\nApp visible: ${formatTime(metrics.visibleMs)}\nAway from app: ${metrics.awayPercent}%\n\nMissions: ${sourceLabel(walk.missionProvenance)}\nReflection: ${sourceLabel(walk.noteProvenance)}\n`;
  download(text, 'text/plain', `pocket-wild-${walk.id.slice(0, 8)}.txt`);
});
$('#download-evidence').addEventListener('click', () => download(JSON.stringify(exportWalk(walk), null, 2), 'application/json', `pocket-wild-evidence-${walk.id.slice(0, 8)}.json`));

$('#journal-open').addEventListener('click', () => {
  const list = $('#journal-list'); list.replaceChildren();
  $('#journal-empty').hidden = journal.length > 0;
  for (const entry of journal) {
    const button = document.createElement('button'); button.className = 'journal-entry';
    const label = document.createElement('strong'); label.textContent = `${dateFormat.format(entry.createdAt)} · ${entry.config.place}`;
    const preview = document.createElement('span'); preview.textContent = (entry.fieldNote || '').slice(0, 110);
    button.append(label, preview);
    button.addEventListener('click', () => {
      if (walk && walk.phase !== 'summary') { message('Your active draft is saved. Finish that walk before opening a previous entry.', true); $('#journal-dialog').close(); return; }
      walk = structuredClone(entry); renderSummary(); showScreen('summary'); $('#journal-dialog').close();
    });
    list.append(button);
  }
  $('#journal-dialog').showModal();
});
$('#journal-close').addEventListener('click', () => $('#journal-dialog').close());

document.addEventListener('visibilitychange', () => { updateVisibility(walk, document.visibilityState === 'visible'); void saveDraft(); });
window.addEventListener('pagehide', () => { updateVisibility(walk, false); void saveDraft(); });
window.addEventListener('pageshow', event => { if (event.persisted) { updateVisibility(walk, document.visibilityState === 'visible'); updateTimer(); } });

async function networkStatus() {
  $('#network-status').textContent = navigator.onLine ? 'ON THIS DEVICE' : 'NO CONNECTION';
  $('#offline-indicator').hidden = navigator.onLine;
}
window.addEventListener('online', networkStatus); window.addEventListener('offline', networkStatus);

async function initialize() {
  networkStatus();
  $('#local-date').textContent = new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date()).toUpperCase();
  try {
    [walk, journal] = await Promise.all([localStore.get('draft'), localStore.get('journal')]);
    walk ||= null; journal ||= []; $('#journal-count').textContent = String(journal.length);
    if (walk?.phase !== 'summary') $('#resume-panel').hidden = !walk;
    if (await localStore.get('model-loaded')) { $('#model-title').textContent = 'Gemma was downloaded'; $('#model-status').textContent = 'Load it from this browser’s cache. Weights stay on this device.'; $('#load-gemma').textContent = 'LOAD CACHED GEMMA'; }
  } catch { message('Local saving is unavailable in this browser. Download notes before closing the tab.', true); }
  if ('serviceWorker' in navigator) {
    try {
      registration = await navigator.serviceWorker.register('./sw.js');
      await navigator.serviceWorker.ready;
      $('#offline-status').textContent = 'The app is saved for offline use. Gemma needs its separate first download.';
    } catch { $('#offline-status').textContent = 'Offline app installation failed. Keep this tab open, or retry on HTTPS.'; }
  }
  const context = document.modelContext;
  if (context?.registerTool) {
    try {
      await context.registerTool({
        name: 'prepare_nature_walk', title: 'Prepare nature walk',
        description: 'Make and display three missions for an outdoor walk. Requires the chosen engine to be ready; does not start the timer.',
        inputSchema: { type: 'object', properties: { duration: { type: 'integer', enum: [10, 20, 30] }, mood: { type: 'string', enum: ['quiet', 'curious', 'playful'] }, place: { type: 'string', enum: ['neighborhood', 'park', 'garden', 'trail'] }, context: { type: 'string', maxLength: 160 }, engine: { type: 'string', enum: ['gemma', 'preset'] } }, required: ['duration', 'mood', 'place', 'engine'], additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: input => { if (!['gemma', 'preset'].includes(input?.engine) || busy) throw new Error('Choose an engine and wait for the current operation.'); return prepareWalk(input, input.engine); },
      });
    } catch (error) { console.warn('Agent action unavailable:', error.message); }
  }
}
initialize();

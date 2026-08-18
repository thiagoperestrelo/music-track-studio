const STEPS = 16;
const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const SCALE_INTERVALS = {
  major: [0,2,4,5,7,9,11],
  minor: [0,2,3,5,7,8,10],
  pentatonicMinor: [0,3,5,7,10],
};

const SECTION_DEFS = [
  { id: 'intro', label: 'Intro', defaultStyle: 'halftime' },
  { id: 'verse', label: 'Verse', defaultStyle: 'rock' },
  { id: 'chorus', label: 'Chorus', defaultStyle: 'metal' },
  { id: 'bridge', label: 'Bridge', defaultStyle: 'halftime' },
  { id: 'outro', label: 'Outro', defaultStyle: 'metal' },
];

const makeDrumSteps = () => Array.from({ length: STEPS }, () => new Set());
const makeSection = (def) => ({
  ...def,
  guitar: Array(STEPS).fill(null),
  bass: Array(STEPS).fill(null),
  drums: makeDrumSteps(),
  drumStyle: def.defaultStyle,
});

const state = {
  sections: SECTION_DEFS.map(makeSection),
  playing: false,
  currentSection: -1,
  currentStep: -1,
  timer: null,
  audioCtx: null,
  master: null,
  noiseBuffer: null,
};

const $ = (id) => document.getElementById(id);
const sectionsEl = $('sections');
NOTE_NAMES.forEach(n => $('root').add(new Option(n, n)));
$('root').value = 'E';

function noteToMidi(note, octave) {
  return (octave + 1) * 12 + NOTE_NAMES.indexOf(note);
}
function midiToFreq(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }
function parseNote(note) {
  const match = note?.match(/^([A-G]#?)(\d)$/);
  if (!match) return null;
  return { name: match[1], octave: Number(match[2]), midi: noteToMidi(match[1], Number(match[2])) };
}
function scaleNotes(root, scale) {
  const rootIndex = NOTE_NAMES.indexOf(root);
  return SCALE_INTERVALS[scale].map(i => NOTE_NAMES[(rootIndex + i) % 12]);
}
function noteOptions(octave=3) {
  const allowed = scaleNotes($('root').value, $('scale').value);
  return ['—', ...allowed.map(n => `${n}${octave}`)];
}
function getSection(sectionId) {
  return state.sections.find(s => s.id === sectionId);
}

function renderArrangement() {
  const bar = $('arrangementBar');
  bar.innerHTML = '';
  state.sections.forEach((section, index) => {
    const button = document.createElement('button');
    button.className = `arrangement-item ${state.playing && state.currentSection === index ? 'playing' : ''}`;
    button.innerHTML = `<span>${index + 1}</span><strong>${section.label}</strong><small>16 passos</small>`;
    button.addEventListener('click', () => document.querySelector(`[data-section-card="${section.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    bar.appendChild(button);
  });
  $('playStatus').textContent = state.playing && state.currentSection >= 0
    ? `${state.sections[state.currentSection].label} · passo ${state.currentStep + 1}`
    : 'Parado';
}

function createSectionCard(section, sectionIndex) {
  const panel = document.createElement('section');
  panel.className = 'song-section panel';
  panel.dataset.sectionCard = section.id;
  panel.innerHTML = `
    <div class="section-heading section-toolbar">
      <div class="section-title-wrap">
        <div class="section-number">${String(sectionIndex + 1).padStart(2, '0')}</div>
        <div>
          <p class="eyebrow">SEÇÃO</p>
          <h2>${section.label}</h2>
        </div>
      </div>
      <div class="section-actions">
        <label>Bateria
          <select data-drum-style="${section.id}">
            <option value="rock">Rock</option>
            <option value="metal">Metal</option>
            <option value="punk">Punk</option>
            <option value="halftime">Half-time</option>
            <option value="djent">Djent</option>
          </select>
        </label>
        <button data-generate="${section.id}">Gerar acompanhamento</button>
        <button data-play-section="${section.id}" class="secondary">▶ Só esta seção</button>
      </div>
    </div>
    <div class="tracks-stack">
      ${trackMarkup(section.id, 'guitar', 'Guitarra', 'power chords / riff')}
      ${trackMarkup(section.id, 'bass', 'Baixo', 'harmonia grave')}
      ${trackMarkup(section.id, 'drums', 'Bateria', 'groove e dinâmica')}
    </div>`;
  sectionsEl.appendChild(panel);
  panel.querySelector(`[data-drum-style="${section.id}"]`).value = section.drumStyle;
}

function trackMarkup(sectionId, key, name, description) {
  return `<div class="track-row">
    <div class="track-meta">
      <div><h3>${name}</h3><span class="badge">${description}</span></div>
      <button class="tiny" data-clear="${sectionId}:${key}">Limpar</button>
    </div>
    <div class="grid-wrap"><div class="step-grid" data-grid="${sectionId}:${key}"></div></div>
  </div>`;
}

function renderMelodicGrid(section, key, octave) {
  const grid = document.querySelector(`[data-grid="${section.id}:${key}"]`);
  if (!grid) return;
  grid.innerHTML = '';
  const options = noteOptions(octave);
  for (let i = 0; i < STEPS; i++) {
    const cell = document.createElement('div');
    cell.className = `step ${section[key][i] ? 'active' : ''} ${isCurrentStep(section.id, i) ? 'playing' : ''}`;
    cell.dataset.stepNumber = String(i + 1);
    const select = document.createElement('select');
    options.forEach(opt => select.add(new Option(opt, opt === '—' ? '' : opt)));
    select.value = section[key][i] || '';
    select.addEventListener('change', e => {
      section[key][i] = e.target.value || null;
      renderDynamic();
    });
    cell.appendChild(select);
    grid.appendChild(cell);
  }
}

function renderDrumGrid(section) {
  const grid = document.querySelector(`[data-grid="${section.id}:drums"]`);
  if (!grid) return;
  grid.innerHTML = '';
  const choices = [['K','Kick'],['S','Snare'],['H','Hi-hat'],['O','Open hat'],['C','Crash']];
  for (let i = 0; i < STEPS; i++) {
    const cell = document.createElement('div');
    const set = section.drums[i];
    cell.className = `step drum-step ${set.size ? 'active' : ''} ${isCurrentStep(section.id, i) ? 'playing' : ''}`;
    cell.dataset.stepNumber = String(i + 1);
    cell.innerHTML = `<span>${set.size ? [...set].join('+') : '—'}</span>`;
    cell.title = 'Clique para alternar Kick → Snare → Hi-hat → Open hat → Crash → vazio';
    cell.addEventListener('click', () => {
      const current = [...set][0];
      const idx = choices.findIndex(c => c[0] === current);
      set.clear();
      const next = choices[(idx + 1) % (choices.length + 1)];
      if (next) set.add(next[0]);
      renderDynamic();
    });
    grid.appendChild(cell);
  }
}

function isCurrentStep(sectionId, step) {
  return state.playing && state.sections[state.currentSection]?.id === sectionId && state.currentStep === step;
}

function renderDynamic() {
  state.sections.forEach(section => {
    renderMelodicGrid(section, 'guitar', 3);
    renderMelodicGrid(section, 'bass', 2);
    renderDrumGrid(section);
  });
  renderArrangement();
}

function renderInitial() {
  sectionsEl.innerHTML = '';
  state.sections.forEach(createSectionCard);
  renderDynamic();
}

function generateBass(section) {
  const mode = $('bassPattern').value;
  const allowed = scaleNotes($('root').value, $('scale').value);
  for (let i = 0; i < STEPS; i++) {
    const g = parseNote(section.guitar[i]);
    if (!g) {
      section.bass[i] = null;
      continue;
    }
    let noteName = g.name;
    if (mode === 'rootFifth' && i % 4 === 2) {
      const rootIndex = NOTE_NAMES.indexOf(g.name);
      const fifth = NOTE_NAMES[(rootIndex + 7) % 12];
      noteName = allowed.includes(fifth) ? fifth : g.name;
    }
    const octave = mode === 'octave' && i % 4 === 2 ? 3 : 2;
    section.bass[i] = `${noteName}${octave}`;
  }
}

function generateDrums(section, style = section.drumStyle) {
  section.drums = makeDrumSteps();
  const add = (i, d) => section.drums[i].add(d);
  const crashStart = () => add(0, 'C');

  for (let i = 0; i < STEPS; i++) {
    if (style === 'rock') {
      if ([0, 7, 8, 14].includes(i)) add(i,'K');
      if ([4,12].includes(i)) add(i,'S');
      if (i % 2 === 0) add(i,'H');
    } else if (style === 'metal') {
      if ([0,1,2,6,8,9,10,14,15].includes(i)) add(i,'K');
      if ([4,12].includes(i)) add(i,'S');
      add(i,'H');
    } else if (style === 'punk') {
      if ([0,2,6,8,10,14].includes(i)) add(i,'K');
      if ([4,12].includes(i)) add(i,'S');
      add(i,'H');
      if ([7,15].includes(i)) add(i,'O');
    } else if (style === 'djent') {
      if ([0,1,3,6,7,10,13,15].includes(i)) add(i,'K');
      if ([4,12].includes(i)) add(i,'S');
      if (i % 2 === 0) add(i,'H');
      if ([11,15].includes(i)) add(i,'O');
    } else {
      if ([0,3,10].includes(i)) add(i,'K');
      if (i === 8) add(i,'S');
      if (i % 2 === 0) add(i,'H');
      if (i === 15) add(i,'O');
    }
  }
  crashStart();
  if (section.id === 'chorus' || section.id === 'outro') add(8, 'C');
}

function ensureAudio() {
  if (state.audioCtx) return state.audioCtx;
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const master = ctx.createGain();
  const compressor = ctx.createDynamicsCompressor();
  master.gain.value = 0.72;
  compressor.threshold.value = -14;
  compressor.knee.value = 12;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.18;
  master.connect(compressor).connect(ctx.destination);

  const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  state.audioCtx = ctx;
  state.master = master;
  state.noiseBuffer = noise;
  return ctx;
}

function makeDistortionCurve(amount = 50) {
  const samples = 2048;
  const curve = new Float32Array(samples);
  const k = amount;
  for (let i = 0; i < samples; i++) {
    const x = i * 2 / samples - 1;
    curve[i] = ((3 + k) * x * 20 * Math.PI / 180) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

function playGuitar(note, stepDuration) {
  const parsed = parseNote(note);
  if (!parsed) return;
  const ctx = ensureAudio();
  const now = ctx.currentTime;
  const output = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const tone = $('guitarTone').value;
  const duration = Math.min(stepDuration * 0.9, 0.34);

  filter.type = 'lowpass';
  filter.frequency.value = tone === 'clean' ? 5200 : tone === 'crunch' ? 3200 : 2450;
  filter.Q.value = 0.7;
  output.gain.setValueAtTime(0.0001, now);
  output.gain.exponentialRampToValueAtTime(tone === 'clean' ? 0.13 : 0.105, now + 0.007);
  output.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  let destination = output;
  if (tone !== 'clean') {
    const shaper = ctx.createWaveShaper();
    shaper.curve = makeDistortionCurve(tone === 'modern' ? 190 : 90);
    shaper.oversample = '4x';
    output.connect(shaper).connect(filter).connect(state.master);
  } else {
    output.connect(filter).connect(state.master);
  }

  const intervals = [0, 7, 12];
  intervals.forEach((interval, idx) => {
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = tone === 'clean' ? 'triangle' : idx === 1 ? 'square' : 'sawtooth';
    osc.detune.value = idx === 1 ? 3 : idx === 2 ? -4 : 0;
    osc.frequency.value = midiToFreq(parsed.midi + interval);
    oscGain.gain.value = idx === 0 ? 0.46 : idx === 1 ? 0.32 : 0.22;
    osc.connect(oscGain).connect(destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  });
}

function playBass(note, stepDuration) {
  const parsed = parseNote(note);
  if (!parsed) return;
  const ctx = ensureAudio();
  const now = ctx.currentTime;
  const duration = Math.min(stepDuration * 0.95, 0.38);
  const bus = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const comp = ctx.createDynamicsCompressor();
  filter.type = 'lowpass';
  filter.frequency.value = 720;
  filter.Q.value = 0.9;
  bus.gain.setValueAtTime(0.0001, now);
  bus.gain.exponentialRampToValueAtTime(0.16, now + 0.006);
  bus.gain.exponentialRampToValueAtTime(0.07, now + 0.08);
  bus.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  bus.connect(filter).connect(comp).connect(state.master);

  const sub = ctx.createOscillator();
  const body = ctx.createOscillator();
  const bodyGain = ctx.createGain();
  sub.type = 'sine';
  body.type = 'square';
  sub.frequency.value = midiToFreq(parsed.midi);
  body.frequency.value = midiToFreq(parsed.midi);
  bodyGain.gain.value = 0.34;
  sub.connect(bus);
  body.connect(bodyGain).connect(bus);
  sub.start(now); body.start(now);
  sub.stop(now + duration + 0.02); body.stop(now + duration + 0.02);
}

function playKick() {
  const ctx = ensureAudio();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(155, now);
  osc.frequency.exponentialRampToValueAtTime(48, now + 0.09);
  gain.gain.setValueAtTime(0.38, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  osc.connect(gain).connect(state.master);
  osc.start(now); osc.stop(now + 0.2);

  const click = ctx.createBufferSource();
  const hp = ctx.createBiquadFilter();
  const clickGain = ctx.createGain();
  click.buffer = state.noiseBuffer;
  hp.type = 'highpass'; hp.frequency.value = 2800;
  clickGain.gain.setValueAtTime(0.075, now);
  clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.018);
  click.connect(hp).connect(clickGain).connect(state.master);
  click.start(now); click.stop(now + 0.025);
}

function playSnare() {
  const ctx = ensureAudio();
  const now = ctx.currentTime;
  const noise = ctx.createBufferSource();
  const band = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  noise.buffer = state.noiseBuffer;
  band.type = 'bandpass'; band.frequency.value = 1800; band.Q.value = 0.6;
  gain.gain.setValueAtTime(0.23, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  noise.connect(band).connect(gain).connect(state.master);
  noise.start(now); noise.stop(now + 0.17);

  const body = ctx.createOscillator();
  const bodyGain = ctx.createGain();
  body.type = 'triangle'; body.frequency.value = 190;
  bodyGain.gain.setValueAtTime(0.12, now);
  bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.10);
  body.connect(bodyGain).connect(state.master);
  body.start(now); body.stop(now + 0.11);
}

function playHat(open = false) {
  const ctx = ensureAudio();
  const now = ctx.currentTime;
  const noise = ctx.createBufferSource();
  const hp = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  const duration = open ? 0.22 : 0.045;
  noise.buffer = state.noiseBuffer;
  hp.type = 'highpass'; hp.frequency.value = 6500;
  gain.gain.setValueAtTime(open ? 0.07 : 0.045, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  noise.connect(hp).connect(gain).connect(state.master);
  noise.start(now); noise.stop(now + duration + 0.01);
}

function playCrash() {
  const ctx = ensureAudio();
  const now = ctx.currentTime;
  const noise = ctx.createBufferSource();
  const hp = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  noise.buffer = state.noiseBuffer;
  hp.type = 'highpass'; hp.frequency.value = 3600;
  gain.gain.setValueAtTime(0.11, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
  noise.connect(hp).connect(gain).connect(state.master);
  noise.start(now); noise.stop(now + 0.9);
}

function stepDurationSeconds() {
  return (60 / Number($('bpm').value)) / 4;
}

function playStep(section, i) {
  const duration = stepDurationSeconds();
  playGuitar(section.guitar[i], duration);
  playBass(section.bass[i], duration);
  const d = section.drums[i];
  if (d.has('K')) playKick();
  if (d.has('S')) playSnare();
  if (d.has('H')) playHat(false);
  if (d.has('O')) playHat(true);
  if (d.has('C')) playCrash();
}

function stop() {
  state.playing = false;
  clearInterval(state.timer);
  state.timer = null;
  state.currentSection = -1;
  state.currentStep = -1;
  renderDynamic();
}

function startPlayback(sectionStart = 0, sectionEnd = state.sections.length - 1) {
  stop();
  ensureAudio().resume();
  state.playing = true;
  let sectionIndex = sectionStart;
  let step = 0;
  const tick = () => {
    state.currentSection = sectionIndex;
    state.currentStep = step;
    playStep(state.sections[sectionIndex], step);
    renderDynamic();
    step += 1;
    if (step >= STEPS) {
      step = 0;
      sectionIndex += 1;
      if (sectionIndex > sectionEnd) {
        stop();
      }
    }
  };
  tick();
  state.timer = setInterval(tick, stepDurationSeconds() * 1000);
}

function serialize() {
  return {
    bpm: $('bpm').value,
    root: $('root').value,
    scale: $('scale').value,
    guitarTone: $('guitarTone').value,
    bassPattern: $('bassPattern').value,
    sections: state.sections.map(section => ({
      ...section,
      drums: section.drums.map(set => [...set]),
    })),
  };
}

function saveProject() {
  localStorage.setItem('music-track-studio-project', JSON.stringify(serialize()));
  const previous = $('saveBtn').textContent;
  $('saveBtn').textContent = '✓ Salvo';
  setTimeout(() => $('saveBtn').textContent = previous, 1200);
}

function loadProject() {
  try {
    const raw = localStorage.getItem('music-track-studio-project');
    if (!raw) return false;
    const data = JSON.parse(raw);
    $('bpm').value = data.bpm || 120;
    $('root').value = data.root || 'E';
    $('scale').value = data.scale || 'minor';
    $('guitarTone').value = data.guitarTone || 'modern';
    $('bassPattern').value = data.bassPattern || 'root';
    if (Array.isArray(data.sections) && data.sections.length === SECTION_DEFS.length) {
      state.sections = data.sections.map((section, idx) => ({
        ...makeSection(SECTION_DEFS[idx]),
        ...section,
        drums: section.drums.map(items => new Set(items)),
      }));
      return true;
    }
  } catch (error) {
    console.warn('Não foi possível carregar o projeto salvo.', error);
  }
  return false;
}

function seedDemo() {
  const patterns = {
    intro: ['E3',null,null,null,'G3',null,null,null,'A3',null,null,null,'E3',null,null,null],
    verse: ['E3',null,'E3',null,'G3',null,'A3',null,'E3',null,'D3',null,'C3',null,'D3',null],
    chorus: ['C3',null,'G3',null,'D3',null,'A3',null,'C3',null,'G3',null,'D3',null,'E3',null],
    bridge: ['A3',null,null,'C3',null,null,'E3',null,'D3',null,null,'C3',null,'D3',null,null],
    outro: ['E3',null,'G3',null,'A3',null,'C3',null,'E3',null,'D3',null,'C3',null,'E3',null],
  };
  state.sections.forEach(section => {
    section.guitar = patterns[section.id].slice();
    generateBass(section);
    generateDrums(section, section.defaultStyle);
  });
}

$('playBtn').addEventListener('click', () => startPlayback());
$('stopBtn').addEventListener('click', stop);
$('saveBtn').addEventListener('click', saveProject);
$('root').addEventListener('change', renderDynamic);
$('scale').addEventListener('change', renderDynamic);
$('bassPattern').addEventListener('change', () => {
  state.sections.forEach(generateBass);
  renderDynamic();
});

document.addEventListener('change', event => {
  const sectionId = event.target.dataset.drumStyle;
  if (!sectionId) return;
  const section = getSection(sectionId);
  section.drumStyle = event.target.value;
  generateDrums(section, section.drumStyle);
  renderDynamic();
});

document.addEventListener('click', event => {
  const generateId = event.target.dataset.generate;
  if (generateId) {
    const section = getSection(generateId);
    generateBass(section);
    generateDrums(section, section.drumStyle);
    renderDynamic();
    return;
  }

  const playSectionId = event.target.dataset.playSection;
  if (playSectionId) {
    const index = state.sections.findIndex(section => section.id === playSectionId);
    startPlayback(index, index);
    return;
  }

  const clearTarget = event.target.dataset.clear;
  if (!clearTarget) return;
  const [sectionId, key] = clearTarget.split(':');
  const section = getSection(sectionId);
  if (key === 'drums') section.drums = makeDrumSteps();
  else section[key] = Array(STEPS).fill(null);
  renderDynamic();
});

if (!loadProject()) seedDemo();
renderInitial();

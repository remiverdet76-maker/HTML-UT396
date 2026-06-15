/* ═══════════════════════════════════════════
   02-audio.js — Moteur audio, FX chain, Flow
   ═══════════════════════════════════════════ */

// Contexte audio avec buffer large — réduit les underruns sur Android/BT
Tone.setContext(new Tone.Context({ latencyHint: 'playback', lookAhead: 0.3 }));

const swapTimers = {};
let nodes = {}, masterGain = null, analyser = null;

let limiter = null;
let eqLow = null, eqMid = null, eqHigh = null;
let masterDelay = null, masterReverb = null, pingPongDelay = null;
let chorus = null, compressor = null;
const LFO_STATE    = {on:false, rate:.25,  depth:.08};
const BREATH_STATE = {on:false, rate:0.13, depth:0.35};
let _lfoNode = null, _lfoGain = null;
let _breathLFO = null, _breathGain = null;
let _btKeepalive = null;
let _fadeDur = 2;
let metaAngle = 0, masterRAF = null;

// ── Oscillateurs raw Web Audio (thread audio natif, zéro overhead JS) ──
// On utilise directement les API Web Audio brutes (OscillatorNode,
// GainNode, StereoPannerNode) plutôt que les wrappers Tone.js, pour
// éliminer tout scheduling Tone sur le thread principal = zéro craquement.
function buildOsc(id, freq, vol, pan) {
  const ctx = Tone.context.rawContext;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const p = ctx.createStereoPanner();
  o.type = 'sine';
  o.frequency.value = Math.max(1, safeF(freq));
  p.pan.value = pan;
  o.connect(g); g.connect(p); p.connect(masterGain.input);
  g.gain.value = 0;
  if (!mutedOscs[id] && vol > 0) {
    const now = ctx.currentTime;
    g.gain.setValueAtTime(0, now);
    g.gain.setTargetAtTime(vol, now, FADE / 5);
  }
  o.start();
  return { o, g, p };
}

function tuneOsc(id, freq) {
  const node = nodes[id]; if (!node) return;
  try {
    const f = Math.max(1, safeF(freq));
    const now = Tone.context.rawContext.currentTime;
    node.o.frequency.cancelScheduledValues(now);
    node.o.frequency.setValueAtTime(node.o.frequency.value, now);
    node.o.frequency.exponentialRampToValueAtTime(f, now + TUNE_T);
  } catch(e) {}
}

function releaseOsc(node) {
  const ctx = Tone.context.rawContext;
  try {
    const now = ctx.currentTime;
    node.g.gain.cancelScheduledValues(now);
    node.g.gain.setValueAtTime(node.g.gain.value, now);
    node.g.gain.setTargetAtTime(0, now, FADE / 5);
    node.o.stop(now + FADE + 0.1);
  } catch(e) {}
  setTimeout(() => {
    try { node.o.disconnect(); } catch(e) {}
    try { node.g.disconnect(); } catch(e) {}
    try { node.p.disconnect(); } catch(e) {}
  }, (FADE + 0.4) * 1000);
}

// Oscillateurs PERSISTANTS : tuneOsc si déjà actifs, buildOsc sinon.
function swapPingala(i) {
  if (!flowing || !masterGain) return;
  const { pingala } = PAIRS[i];
  if (nodes[pingala.id]) {
    tuneOsc(pingala.id, calcPFreq(i));
  } else {
    nodes[pingala.id] = buildOsc(pingala.id, calcPFreq(i), pingala.vol, -1);
  }
  setTimeout(() => { if (flowing && masterGain) swapIda(i); }, 40);
  updatePairUI(i);
}
function swapIda(i) {
  if (!flowing || !masterGain) return;
  const { ida } = PAIRS[i];
  if (nodes[ida.id]) {
    tuneOsc(ida.id, calcIFreq(i));
  } else {
    nodes[ida.id] = buildOsc(ida.id, calcIFreq(i), ida.vol, 1);
  }
  updatePairUI(i);
}
function swapPDebounced(i) { clearTimeout(swapTimers['p'+i]); swapTimers['p'+i] = setTimeout(() => swapPingala(i), 380); }
function swapIDebounced(i) { clearTimeout(swapTimers['i'+i]); swapTimers['i'+i] = setTimeout(() => swapIda(i), 380); }

// Rampe gain sur un oscillateur raw (mute, vol, zoom)
function setOscGain(id, vol) {
  const node = nodes[id]; if (!node) return;
  const now = Tone.context.rawContext.currentTime;
  node.g.gain.cancelScheduledValues(now);
  node.g.gain.setValueAtTime(node.g.gain.value, now);
  node.g.gain.setTargetAtTime(vol, now, 0.1);
}

// Rampe sur Tone.Param (masterGain, lfoGain…)
function safeRamp(gainParam, target, duration) {
  const now = Tone.now();
  gainParam.cancelScheduledValues(now);
  gainParam.setValueAtTime(gainParam.value, now);
  gainParam.setTargetAtTime(target, now, Math.max(0.01, duration / 5));
}

// ── FX Chain (créée une seule fois, sans chorus) ──────────────
function initFXChain() {
  if (eqLow) return;
  eqLow        = new Tone.Filter({ type: 'lowshelf',  frequency: 200,  Q: 1, gain: 0 });
  eqMid        = new Tone.Filter({ type: 'peaking',   frequency: 1000, Q: 1, gain: 0 });
  eqHigh       = new Tone.Filter({ type: 'highshelf', frequency: 5000, Q: 1, gain: 0 });
  compressor   = new Tone.Compressor({ threshold: -24, ratio: 4, attack: 0.02, release: 0.25 });
  masterDelay  = new Tone.FeedbackDelay({ delayTime: 0.3, feedback: 0.3, wet: 0 });
  masterReverb = new Tone.Reverb({ decay: 1.5, preDelay: 0.05, wet: 0 });
  limiter      = new Tone.Limiter(-1.5).toDestination();
  pingPongDelay = new Tone.PingPongDelay({ delayTime: 0.25, feedback: 0.3, wet: 0 });
  // Chorus retiré : toujours wet:0, inutile, source potentielle d'underrun WebView
  eqLow.chain(eqMid, eqHigh, compressor, masterDelay, pingPongDelay, limiter);
}

// Branche/débranche la réverbe selon qu'elle est utilisée (anti-craquement BT).
let _reverbActive = false;
function _setReverbActive(on) {
  if (!masterReverb || !masterDelay || !pingPongDelay || !limiter || on === _reverbActive) return;
  try {
    if (on) {
      masterDelay.disconnect(pingPongDelay);
      masterDelay.connect(masterReverb);
      masterReverb.connect(pingPongDelay);
    } else {
      masterDelay.disconnect(masterReverb);
      try { masterReverb.disconnect(pingPongDelay); } catch(e) {}
      masterDelay.connect(pingPongDelay);
    }
    _reverbActive = on;
  } catch(e) {}
}

const REVERB_SPACES = {
  sec:        { decay: 0.4,  preDelay: 0.01 },
  grotte:     { decay: 2.8,  preDelay: 0.08 },
  cathedrale: { decay: 5.5,  preDelay: 0.15 },
  cosmos:     { decay: 14.0, preDelay: 0.40 }
};
async function setReverbSpace(name) {
  const s = REVERB_SPACES[name]; if (!s || !masterReverb) return;
  masterReverb.decay = s.decay; masterReverb.preDelay = s.preDelay;
  try { await masterReverb.generate(); } catch(e) {}
  const sl = document.getElementById('reverbWet');
  if (sl && parseFloat(sl.value) < 0.05) { sl.value = 0.32; updateFX('reverbWet', 0.32); }
}

function setFadeDur(v) {
  _fadeDur = Math.max(0.5, Math.min(15, parseFloat(v)));
  const el = document.getElementById('sv-fade'); if (el) el.textContent = _fadeDur.toFixed(1) + 's';
}

function lfoToggle(on) {
  LFO_STATE.on = on;
  if (!_lfoNode || !_lfoGain) return;
  if (on) {
    _lfoNode.connect(_lfoGain.gain);
  } else {
    try { _lfoNode.disconnect(); } catch(e) {}
    _lfoGain.gain.setTargetAtTime(1, Tone.now(), 0.1);
  }
}
function lfoSet(param, v) {
  LFO_STATE[param] = parseFloat(v);
  if (_lfoNode) {
    if (param === 'rate')  _lfoNode.frequency.value = LFO_STATE.rate;
    if (param === 'depth') { _lfoNode.min = 1 - LFO_STATE.depth; _lfoNode.max = 1 + LFO_STATE.depth; }
  }
  const el = document.getElementById('sv-lfo-' + param); if (el) el.textContent = parseFloat(v).toFixed(2);
}

function breathToggle(on) {
  BREATH_STATE.on = on;
  if (!_breathLFO || !_breathGain) return;
  if (on) {
    _breathLFO.connect(_breathGain.gain);
  } else {
    try { _breathLFO.disconnect(); } catch(e) {}
    _breathGain.gain.setTargetAtTime(1, Tone.now(), 0.5);
  }
}
function breathSet(param, v) {
  BREATH_STATE[param] = parseFloat(v);
  if (_breathLFO) {
    if (param === 'rate')  _breathLFO.frequency.value = BREATH_STATE.rate;
    if (param === 'depth') { _breathLFO.min = 1 - BREATH_STATE.depth; _breathLFO.max = 1 + BREATH_STATE.depth; }
  }
  const el = document.getElementById('sv-breath-' + param);
  if (el) el.textContent = param === 'rate'
    ? (BREATH_STATE.rate * 60).toFixed(1) + ' /min'
    : parseFloat(v).toFixed(2);
}

function _startBTKeepalive() {
  if (_btKeepalive) return;
  try {
    const ctx = Tone.context.rawContext;
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    src.connect(ctx.destination);
    src.start();
    _btKeepalive = src;
  } catch(e) {}
}

// chorus = null (supprimé) — stubs pour compatibilité panel FX
function setChorusDepth(v) {}
function setChorusRate(v)  {}
function setCompThresh(v)  { if (compressor) try { compressor.threshold.value = parseFloat(v); } catch(e) {} }
function setCompRatio(v)   { if (compressor) try { compressor.ratio.value = parseFloat(v); } catch(e) {} }

function playBell() {
  try {
    if (Tone.context.state !== 'running') return;
    const b = new Tone.Synth({ oscillator:{type:'sine'}, envelope:{attack:.001, decay:3, sustain:.1, release:4} }).toDestination();
    b.triggerAttackRelease(432, '8n', Tone.now());
    setTimeout(() => { try { b.dispose(); } catch(e) {} }, 9000);
  } catch(e) {}
}

// ── Start / Stop ──────────────────────────────────────────────
let flowing = false;

async function startFlow() {
  ui('idle', '✦ Éveil du Metatron…');
  try {
    await Tone.start();
    if (Tone.context.state !== 'running') await Tone.context.resume();
    document.addEventListener('visibilitychange', function _onVis() {
      if (document.visibilityState === 'visible' && Tone.context.state !== 'running') {
        Tone.context.resume();
      }
    });
    _startBTKeepalive();
    initFXChain();
    analyser   = new Tone.Analyser('waveform', 256);
    masterGain = new Tone.Gain(0);
    _lfoGain   = new Tone.Gain(1);
    const _now = Tone.now();
    masterGain.gain.setValueAtTime(0, _now);
    masterGain.gain.setTargetAtTime(masterVol, _now, _fadeDur / 3);
    masterGain.connect(_lfoGain);
    _breathGain = new Tone.Gain(1);
    _lfoGain.connect(_breathGain);
    _breathGain.connect(eqLow);
    masterGain.connect(analyser);
    _lfoNode = new Tone.LFO({ frequency: LFO_STATE.rate, min: 1 - LFO_STATE.depth, max: 1 + LFO_STATE.depth, type: 'sine' }).start();
    if (LFO_STATE.on) _lfoNode.connect(_lfoGain.gain);
    _breathLFO = new Tone.LFO({ frequency: BREATH_STATE.rate, min: 1 - BREATH_STATE.depth, max: 1 + BREATH_STATE.depth, type: 'sine' }).start();
    if (BREATH_STATE.on) _breathLFO.connect(_breathGain.gain);
    flowing = true;
    try { window.Capacitor?.Plugins?.KeepAwake?.keepAwake?.(); } catch(e) {}
    // Démarrage échelonné : évite le pic GC du premier rendu
    PAIRS.forEach((_, i) => setTimeout(() => swapPingala(i), 60 + i * 60));
    PAIRS.forEach((_, i) => updateOrbUI(i));
    ui('live', 'En expansion…');
  } catch(err) {
    flowing = false; nodes = {};
    ui('idle', 'Erreur audio — relancer');
  }
}

async function stopFlow() {
  ui('idle', 'Dissolution…');
  try { window.Capacitor?.Plugins?.KeepAwake?.allowSleep?.(); } catch(e) {}
  if (progRunning) stopProgression();
  Object.keys(swapTimers).forEach(k => { clearTimeout(swapTimers[k]); delete swapTimers[k]; });
  try {
    if (masterGain) {
      const _t = Tone.now();
      masterGain.gain.cancelScheduledValues(_t);
      masterGain.gain.setTargetAtTime(0, _t, _fadeDur / 8);
    }
  } catch(e) {}
  const nodesCopy = {...nodes};
  nodes = {};
  flowing = false;
  const _rawCtx = Tone.context.rawContext;
  Object.values(nodesCopy).forEach(n => {
    if (!n) return;
    try {
      const now = _rawCtx.currentTime;
      n.g.gain.cancelScheduledValues(now);
      n.g.gain.setTargetAtTime(0, now, 0.05);
      n.o.stop(now + 0.3);
    } catch(e) {}
    setTimeout(() => {
      try { n.o.disconnect(); } catch(e) {}
      try { n.g.disconnect(); } catch(e) {}
      try { n.p.disconnect(); } catch(e) {}
    }, 500);
  });
  setTimeout(() => {
    [_lfoNode, _lfoGain, _breathLFO, _breathGain, masterGain, analyser].forEach(x => {
      try { x?.disconnect(); } catch(e){}
      try { x?.dispose?.(); } catch(e){}
    });
    _lfoNode = null; _lfoGain = null; _breathLFO = null; _breathGain = null; masterGain = null; analyser = null;
    PAIRS.forEach((_, i) => updateOrbUI(i));
    const mc = document.getElementById('vpc-p' + MASTER_IDX);
    if (mc) mc.style.boxShadow = '';
    ui('idle', 'Metatron immobile');
  }, 600);
}

// ── Master Tick (RAF) ─────────────────────────────────────────
let _glowFrame = 0;
function masterTick() {
  masterRAF = requestAnimationFrame(masterTick);
  metaAngle = (metaAngle + 0.003) % (Math.PI * 2);
  drawMetatron();
  if (!flowing || !analyser || document.visibilityState === 'hidden') return;
  if ((_glowFrame++ & 1) === 0) { drawSpectroid(); return; }
  const data = analyser.getValue();
  let sum = 0, count = 0;
  for (let k = 0; k < data.length; k += 4) { sum += Math.abs(data[k]); count++; }
  const e = Math.min(1, sum / count * 7);
  const mc = document.getElementById('vpc-p' + MASTER_IDX);
  if (mc) {
    const g = Math.round(e * 45);
    const a = (0.12 + e * .48).toFixed(2);
    mc.style.boxShadow = `0 0 ${g}px rgba(255,160,255,${a}),0 0 ${g*2}px rgba(255,160,255,${(+a*.35).toFixed(2)}),inset 0 0 ${Math.round(g*.5)}px rgba(255,160,255,${(+a*.25).toFixed(2)})`;
  }
  PAIRS.forEach((pair, i) => {
    if (i === MASTER_IDX) return;
    const vcp = document.getElementById('vpc-p' + i);
    if (!vcp || mutedOscs[pair.pingala.id]) return;
    const lvl = Math.min(1, e * 0.65 + 0.12);
    const alpha = Math.round(lvl * 200).toString(16).padStart(2, '0');
    vcp.style.boxShadow = `0 0 ${Math.round(lvl*22)}px ${pair.color}${alpha},0 0 ${Math.round(lvl*10)}px ${pair.color}44`;
  });
  drawSpectroid();
}

function ui(state, text) {
  const dot=document.getElementById('dot'); if(dot) dot.classList.toggle('live', state === 'live');
  const st=document.getElementById('status'); if(st) st.classList.toggle('live', state === 'live');
  const stxt=document.getElementById('stxt'); if(stxt) stxt.textContent = text;
  const bdis = document.getElementById('btn-dis');
  const bray = document.getElementById('btn-ray');
  if (bdis) bdis.disabled = (state !== 'live');
  if (bray) bray.disabled = (state === 'live');
}

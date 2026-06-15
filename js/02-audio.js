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
let _lfoNode = null, _lfoGain = null;  // LFO natif Tone.js (audio thread)
let _breathLFO = null, _breathGain = null;
let _btKeepalive = null;               // oscillateur silencieux — maintient le stream A2DP actif
let _fadeDur = 2;
let metaAngle = 0, masterRAF = null;

// ── Moteur AudioWorklet (synthèse sinus dans le thread audio) ──
// Tous les oscillateurs sont générés échantillon par échantillon dans
// le thread de rendu audio → immunisé au jank du thread principal
// (GC, layout, RAF) qui causait les craquements/déchirements sur WebView
// Android. Phase continue + lissage fréq/gain par échantillon = zéro clic.
// Le processeur est injecté via Blob URL (aucun fichier externe dans l'APK).
const _WORKLET_SRC = `
class OmchaProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.N = 24;
    this.phase = new Float32Array(this.N);
    this.freq  = new Float32Array(this.N);
    this.tFreq = new Float32Array(this.N);
    this.gain  = new Float32Array(this.N);
    this.tGain = new Float32Array(this.N);
    this.panL  = new Float32Array(this.N);
    this.panR  = new Float32Array(this.N);
    this.act   = new Uint8Array(this.N);
    // Coeffs de lissage one-pole (constantes de temps en secondes)
    this.cF = Math.exp(-1 / (0.06 * sampleRate));
    this.cG = Math.exp(-1 / (0.08 * sampleRate));
    for (let s = 0; s < this.N; s++) { this.panL[s] = 0.707; this.panR[s] = 0.707; }
    this.port.onmessage = (e) => {
      const d = e.data, s = d.s;
      if (d.t === 's') {
        if (d.f !== undefined) { this.tFreq[s] = d.f; if (d.init) this.freq[s] = d.f; }
        if (d.g !== undefined) this.tGain[s] = d.g;
        if (d.p !== undefined) {
          const a = (d.p + 1) * 0.25 * Math.PI;
          this.panL[s] = Math.cos(a); this.panR[s] = Math.sin(a);
        }
        if (d.init) this.phase[s] = Math.random();
        this.act[s] = 1;
      } else if (d.t === 'alloff') {
        for (let k = 0; k < this.N; k++) this.tGain[k] = 0;
      }
    };
  }
  process(inputs, outputs) {
    const out = outputs[0], L = out[0], R = out[1], n = L.length;
    const TWO_PI = 6.283185307179586, sr = sampleRate, cF = this.cF, cG = this.cG;
    for (let i = 0; i < n; i++) {
      let l = 0, r = 0;
      for (let s = 0; s < this.N; s++) {
        if (!this.act[s]) continue;
        this.freq[s] = this.tFreq[s] + (this.freq[s] - this.tFreq[s]) * cF;
        this.gain[s] = this.tGain[s] + (this.gain[s] - this.tGain[s]) * cG;
        let ph = this.phase[s] + this.freq[s] / sr;
        ph -= Math.floor(ph);
        this.phase[s] = ph;
        const v = Math.sin(ph * TWO_PI) * this.gain[s];
        l += v * this.panL[s]; r += v * this.panR[s];
      }
      L[i] = l; R[i] = r;
    }
    return true;
  }
}
registerProcessor('omcha-proc', OmchaProcessor);
`;

let omchaNode = null;
let _workletReady = false;
const _initedSlots = {};

// Slot par oscillateur : pingala paire i → 2*i, ida → 2*i+1
const _slotOf = {};
PAIRS.forEach((p, i) => { _slotOf[p.pingala.id] = 2 * i; _slotOf[p.ida.id] = 2 * i + 1; });

async function _ensureWorklet(ctx) {
  if (_workletReady) return;
  const url = URL.createObjectURL(new Blob([_WORKLET_SRC], { type: 'application/javascript' }));
  await ctx.audioWorklet.addModule(url);
  URL.revokeObjectURL(url);
  _workletReady = true;
}

function _post(msg) { if (omchaNode) try { omchaNode.port.postMessage(msg); } catch(e) {} }

// Règle le gain d'un oscillateur (id p0/i0…) — lissé dans le worklet
function setOscGain(id, vol) { _post({ t: 's', s: _slotOf[id], g: vol }); }

// Glisse la fréquence d'un oscillateur — lissée dans le worklet (zéro clic)
function tuneOsc(id, freq) { _post({ t: 's', s: _slotOf[id], f: safeF(freq) }); }

// Active/retune un oscillateur (init au 1er appel : phase aléatoire, freq directe)
function swapPingala(i) {
  if (!flowing) return;
  const { pingala } = PAIRS[i];
  const slot = 2 * i, init = !_initedSlots[slot];
  _post({ t: 's', s: slot, f: safeF(calcPFreq(i)), g: mutedOscs[pingala.id] ? 0 : pingala.vol, p: -1, init });
  _initedSlots[slot] = true;
  swapIda(i);
  updatePairUI(i);
}
function swapIda(i) {
  if (!flowing) return;
  const { ida } = PAIRS[i];
  const slot = 2 * i + 1, init = !_initedSlots[slot];
  _post({ t: 's', s: slot, f: safeF(calcIFreq(i)), g: mutedOscs[ida.id] ? 0 : ida.vol, p: 1, init });
  _initedSlots[slot] = true;
  updatePairUI(i);
}
function swapPDebounced(i) { clearTimeout(swapTimers['p'+i]); swapTimers['p'+i] = setTimeout(() => swapPingala(i), 380); }
function swapIDebounced(i) { clearTimeout(swapTimers['i'+i]); swapTimers['i'+i] = setTimeout(() => swapIda(i), 380); }

// Rampe douce sur un AudioParam Tone (masterGain) — inchangé
function safeRamp(gainParam, target, duration) {
  const now = Tone.now();
  gainParam.cancelScheduledValues(now);
  gainParam.setValueAtTime(gainParam.value, now);
  gainParam.setTargetAtTime(target, now, Math.max(0.01, duration / 5));
}

// ── FX Chain (créée une seule fois) ──────────────────────────
function initFXChain() {
  if (eqLow) return;
  eqLow       = new Tone.Filter({ type: 'lowshelf',  frequency: 200,  Q: 1, gain: 0 });
  eqMid       = new Tone.Filter({ type: 'peaking',   frequency: 1000, Q: 1, gain: 0 });
  eqHigh      = new Tone.Filter({ type: 'highshelf', frequency: 5000, Q: 1, gain: 0 });
  chorus      = new Tone.Chorus({ frequency: 0.8, delayTime: 3.5, depth: 0, wet: 0 }).start();
  compressor  = new Tone.Compressor({ threshold: -24, ratio: 4, attack: 0.02, release: 0.25 });
  masterDelay  = new Tone.FeedbackDelay({ delayTime: 0.3, feedback: 0.3, wet: 0 });
  masterReverb = new Tone.Reverb({ decay: 1.5, preDelay: 0.05, wet: 0 });
  limiter       = new Tone.Limiter(-1.5).toDestination();
  pingPongDelay = new Tone.PingPongDelay({ delayTime: 0.25, feedback: 0.3, wet: 0 });
  // Réverbe à convolution NON inline par défaut (off) : elle convolue en
  // permanence sinon = gros coût CPU mobile → underrun BT. On la branche
  // seulement quand wet > 0 (voir _setReverbActive).
  eqLow.chain(eqMid, eqHigh, chorus, compressor, masterDelay, pingPongDelay, limiter);
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

// Espaces de réverbe spatiale
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

function setChorusDepth(v) { if (chorus) try { chorus.depth = parseFloat(v); } catch(e) {} }
function setChorusRate(v)  { if (chorus) try { chorus.frequency.value = parseFloat(v); } catch(e) {} }
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
    // Reprendre l'audio après retour de veille (Android Doze / écran off)
    document.addEventListener('visibilitychange', function _onVis() {
      if (document.visibilityState === 'visible' && Tone.context.state !== 'running') {
        Tone.context.resume();
      }
    });
    const _rawCtx = Tone.context.rawContext;
    await _ensureWorklet(_rawCtx);
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
    // LFO natif Tone.js — fonctionne dans l'audio thread, zéro commandes JS
    _lfoNode = new Tone.LFO({ frequency: LFO_STATE.rate, min: 1 - LFO_STATE.depth, max: 1 + LFO_STATE.depth, type: 'sine' }).start();
    if (LFO_STATE.on) _lfoNode.connect(_lfoGain.gain);
    _breathLFO = new Tone.LFO({ frequency: BREATH_STATE.rate, min: 1 - BREATH_STATE.depth, max: 1 + BREATH_STATE.depth, type: 'sine' }).start();
    if (BREATH_STATE.on) _breathLFO.connect(_breathGain.gain);
    // Worklet : un seul nœud stéréo génère tous les oscillateurs → masterGain
    omchaNode = new AudioWorkletNode(_rawCtx, 'omcha-proc', {
      numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2]
    });
    Tone.connect(omchaNode, masterGain);
    flowing = true;
    // APK Android : empêche la veille CPU/écran pendant le flux (anti-throttle
    // Doze → moins de craquement BT). Ignoré sur le web (Capacitor absent).
    try { window.Capacitor?.Plugins?.KeepAwake?.keepAwake?.(); } catch(e) {}
    // Tous les oscillateurs démarrent ensemble : le worklet ne crée aucun
    // nœud sur le thread principal, donc aucun pic CPU. Fade-in via le gain.
    PAIRS.forEach((_, i) => swapPingala(i));
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
  flowing = false;
  // Coupe doucement tous les oscillateurs dans le worklet (lissage interne)
  _post({ t: 'alloff' });
  Object.keys(_initedSlots).forEach(k => delete _initedSlots[k]);
  setTimeout(() => {
    try { omchaNode?.disconnect(); } catch(e) {}
    omchaNode = null;
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
  // LFO géré nativement par Tone.LFO — aucun traitement JS ici
  if (!flowing || !analyser || document.visibilityState === 'hidden') return;
  // Throttle des écritures boxShadow (style-recalc) : 1 frame sur 2.
  // Soulage le thread principal → moins d'underruns audio sur mobile/BT.
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

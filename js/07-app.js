/* ═══════════════════════════════════════════
   07-app.js — État, presets, progression, navigation, init
   ═══════════════════════════════════════════ */

// ── Progression Harmonique ────────────────────────────────────────
let progRunning = false;
let progTimer   = null;
let progDir     = 1;
let progFreqCur = 252;

function getProgRange() {
  const lo = Math.max(36,   Math.min(864, parseInt(document.getElementById('prog-min')?.value)||36));
  const hi = Math.max(lo+1, Math.min(864, parseInt(document.getElementById('prog-max')?.value)||864));
  return { lo, hi };
}
function progStep() {
  const ri = parseInt(document.getElementById('prog-ratio').value);
  const r  = RATIO_OPTS[ri].r;
  const { lo, hi } = getProgRange();
  let next = Math.round(progFreqCur * (progDir===1 ? r : 1/r) * 100) / 100;
  if (next > hi) next = lo;
  if (next < lo) next = hi;
  progFreqCur = Math.max(lo, Math.min(hi, next));
  masterFreq  = Math.round(progFreqCur);
  updateDisplay();
  if (flowing) PAIRS.forEach((pair,i) => { tuneOsc(pair.pingala.id,calcPFreq(i)); tuneOsc(pair.ida.id,calcIFreq(i)); });
  const disp = document.getElementById('prog-display');
  if (disp) { disp.textContent=masterFreq+' Hz · '+RATIO_OPTS[ri].l; disp.classList.add('active'); }
  saveState();
}
function startProgression() {
  const dur = parseInt(document.getElementById('prog-dur').value)||4000;
  progFreqCur = masterFreq; progRunning = true;
  const on = document.getElementById('btn-prog-on'), off = document.getElementById('btn-prog-off');
  if (on) on.classList.add('running');
  if (off) off.classList.remove('running');
  const disp = document.getElementById('prog-display');
  if (disp) disp.textContent = masterFreq+' Hz — départ';
  progStep();
  progTimer = setInterval(progStep, dur);
}
function stopProgression() {
  progRunning = false;
  clearInterval(progTimer); progTimer = null;
  const on = document.getElementById('btn-prog-on'), off = document.getElementById('btn-prog-off');
  if (on) on.classList.remove('running');
  const disp = document.getElementById('prog-display');
  if (disp) { disp.textContent=masterFreq+' Hz — arrêté'; disp.classList.remove('active'); }
}

// ── Persistance localStorage ──────────────────────────────────────
let _saveTimer = null;
function saveState() { clearTimeout(_saveTimer); _saveTimer = setTimeout(_doSave, 500); }
function _doSave() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      masterFreq, globalDelta, masterVol, sphereColorIdx: _sphereColorIdx, zoomLevel,
      pairs: PAIRS.map(p => ({
        ri:p.pingala.ri, n:p.pingala.n, volP:p.pingala.vol, baseFreq:p.pingala.baseFreq,
        delta:p.ida.delta, polarity:p.ida.polarity, volI:p.ida.vol,
        mutedP:!!mutedOscs[p.pingala.id], mutedI:!!mutedOscs[p.ida.id]
      }))
    }));
  } catch(e) {}
}
function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_KEY));
    if (!s) return;
    if (s.masterFreq>=36&&s.masterFreq<=432) masterFreq = s.masterFreq;
    if (s.globalDelta>0) globalDelta = s.globalDelta;
    if (s.masterVol>=0&&s.masterVol<=1) masterVol = s.masterVol;
    if (typeof s.sphereColorIdx==='number') _sphereColorIdx = s.sphereColorIdx % SPHERE_COLORS_12.length;
    if (typeof s.zoomLevel==='number') zoomLevel = s.zoomLevel % TORUS_ZOOMS.length;
    (s.pairs||[]).forEach((sp,i) => {
      if (!PAIRS[i]) return;
      if (sp.ri>=0&&sp.ri<RATIO_OPTS.length) PAIRS[i].pingala.ri = sp.ri;
      if (!isNaN(sp.n)&&sp.n>=0) PAIRS[i].pingala.n = sp.n;
      if (sp.volP>=0) PAIRS[i].pingala.vol = sp.volP;
      const freqMax = i >= 7 ? 648 : 432;
      if (sp.baseFreq>=36&&sp.baseFreq<=freqMax) PAIRS[i].pingala.baseFreq = sp.baseFreq;
      if (sp.delta>0) PAIRS[i].ida.delta = sp.delta;
      if (sp.polarity===1||sp.polarity===-1) PAIRS[i].ida.polarity = sp.polarity;
      if (sp.volI>=0) PAIRS[i].ida.vol = sp.volI;
      mutedOscs[PAIRS[i].pingala.id] = !!sp.mutedP;
      mutedOscs[PAIRS[i].ida.id]     = !!sp.mutedI;
    });
  } catch(e) {}
}

// ── Presets ───────────────────────────────────────────────────────
const SOLFEGE = {
  36:'Ut₁', 72:'Ut₂', 108:'Sol₁', 144:'Ré₂', 180:'La₂',
  216:'Mi₂', 252:'Si♭₂', 288:'Ré₃', 324:'Sol₃', 360:'La₃',
  396:'Sol♭₃', 432:'La₃☉'
};
let presetSelected = 252;

function selectPreset(freq) {
  presetSelected = freq;
  document.querySelectorAll('.preset-freq-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.freq)===freq);
  });
}
function applyPreset() {
  setMasterFreq(presetSelected);
  if (flowing) PAIRS.forEach((_,i) => swapPingala(i));
  else updateDisplay();
  saveState();
  const btn = document.getElementById('preset-launch-btn');
  if (btn) { btn.textContent='✓ Appliqué'; setTimeout(()=>btn.textContent='▶ Lancer',1800); }
}

// ── Export config ─────────────────────────────────────────────────
function exportState() {
  const state = {
    f:masterFreq, d:globalDelta, v:masterVol,
    p:PAIRS.map(p=>({ri:p.pingala.ri,n:p.pingala.n,vp:p.pingala.vol,dt:p.ida.delta,po:p.ida.polarity,vi:p.ida.vol}))
  };
  try {
    navigator.clipboard.writeText(JSON.stringify(state));
    const s = document.getElementById('stxt');
    if (s) { const prev=s.textContent; s.textContent='✓ Config copiée !'; setTimeout(()=>s.textContent=prev,2200); }
  } catch(e) {}
}

// ── Plein écran ───────────────────────────────────────────────────
function toggleFullscreen() {
  const el = document.documentElement;
  if (document.fullscreenElement || document.webkitFullscreenElement) {
    (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  } else {
    (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
  }
}
document.addEventListener('fullscreenchange', () => {
  const btn = document.getElementById('btn-fs');
  if (btn) btn.textContent = document.fullscreenElement ? '✕' : '⤢';
});

// ── Menu déroulant ───────────────────────────────────────────────
function toggleMenu() {
  const m = document.getElementById('drop-menu');
  const b = document.getElementById('menu-backdrop');
  const btn = document.getElementById('bnt-menu');
  if (!m) return;
  const open = m.classList.contains('open');
  m.classList.toggle('open', !open);
  if (b) b.classList.toggle('open', !open);
  if (btn) btn.classList.toggle('on', !open);
  if (!open) closePanel();
}
function closeMenu() {
  const m = document.getElementById('drop-menu');
  const b = document.getElementById('menu-backdrop');
  const btn = document.getElementById('bnt-menu');
  if (m) m.classList.remove('open');
  if (b) b.classList.remove('open');
  if (btn) btn.classList.remove('on');
}

// ── Panel navigation (tab-nav centré) ────────────────────────────
let _openPanel = null;
let _openBtnId = null;

function tPanel(panId, btnId) {
  const pan = document.getElementById(panId);
  const btn = document.getElementById(btnId);
  if (!pan) return;

  const mainBtn = document.getElementById('bnt-main');

  if (_openPanel === panId) {
    pan.classList.remove('open');
    pan.setAttribute('inert', '');
    if (btn) btn.classList.remove('on');
    _openPanel = null; _openBtnId = null;
    if (mainBtn) mainBtn.classList.add('active');
    return;
  }

  if (_openPanel) {
    const old = document.getElementById(_openPanel);
    if (old) { old.classList.remove('open'); old.setAttribute('inert', ''); }
    if (_openBtnId) { const ob = document.getElementById(_openBtnId); if (ob) ob.classList.remove('on'); }
  }

  pan.classList.add('open');
  pan.removeAttribute('inert');
  if (btn) btn.classList.add('on');
  _openPanel = panId; _openBtnId = btnId;
  if (mainBtn) mainBtn.classList.remove('active');
  if (panId === 'panFX') requestAnimationFrame(()=>{ initEQ2D(document.getElementById('eq2d-canvas')); _eq2dDirty=true; });
}

function openTab(id) { tPanel(id, null); }
function closePanel() {
  if (_openPanel) {
    const old = document.getElementById(_openPanel);
    if (old) { old.classList.remove('open'); old.setAttribute('inert', ''); }
    if (_openBtnId) { const ob = document.getElementById(_openBtnId); if (ob) ob.classList.remove('on'); }
    _openPanel = null; _openBtnId = null;
  }
  const mainBtn = document.getElementById('bnt-main');
  if (mainBtn) mainBtn.classList.add('active');
}

// ── Infobar live ───────────────────────────────────────────────────
function updateInfobar() {
  const ibFreq = document.getElementById('ib-freq');
  const ibFlux = document.getElementById('ib-flux');
  const ibGeo  = document.getElementById('ib-geo');
  const ibUT   = document.getElementById('ib-ut');
  const hdrFreq = document.getElementById('hdr-freq');

  if (ibFreq) ibFreq.textContent = masterFreq + ' Hz';
  if (ibFlux) {
    ibFlux.textContent = flowing ? 'ON' : 'OFF';
    ibFlux.className   = 'ib-v ' + (flowing ? 'ib-live' : 'ib-off');
  }
  if (ibGeo) ibGeo.textContent = '—';
  if (hdrFreq) hdrFreq.textContent = masterFreq + ' Hz';

}

// ── Oscillator modal ───────────────────────────────────────────────
let _oscModalIdx = -1;

function openOscModal(i) {
  _oscModalIdx = i;
  const modal    = document.getElementById('osc-modal');
  const backdrop = document.getElementById('backdrop');
  const title    = document.getElementById('osc-modal-title');
  const body     = document.getElementById('osc-modal-body');
  if (!modal || !body) return;

  const pair = PAIRS[i];
  if (title) title.textContent = i===MASTER_IDX ? '✦ Oscillateur Maître' : `✦ Canal ${i+1} — ${pair.label}`;
  body.innerHTML = buildPairHTML(pair, i);

  modal.classList.add('open');
  if (backdrop) backdrop.classList.add('open');
}

function closeOscModal() {
  const modal    = document.getElementById('osc-modal');
  const backdrop = document.getElementById('backdrop');
  if (modal)    modal.classList.remove('open');
  if (backdrop) backdrop.classList.remove('open');
  _oscModalIdx = -1;
}

// ── Minuterie de méditation ───────────────────────────────────────
const _TIMER_KEY = 'fbf432-timer';
let _sesTimer = null, _sesDur = 0, _sesElapsed = 0, _sesMins = 20;

function timerPreset(mins) {
  _sesMins = mins;
  document.querySelectorAll('.fx-timer-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.textContent) === mins);
  });
  _updateTimerDisplay(_sesDur > 0 ? (_sesDur - _sesElapsed) : mins * 60);
}

function timerToggle() {
  if (_sesTimer) { _stopTimer(); return; }
  _sesDur = _sesMins * 60; _sesElapsed = 0;
  _updateTimerDisplay(_sesDur);
  _updateTimerHUD(_sesDur, _sesDur);
  playBell();
  _startTimerTick();
  const btn = document.getElementById('btn-timer-start');
  if (btn) { btn.textContent = '■ Arrêter'; btn.style.color = '#FF8E8E'; btn.style.borderColor = '#FF8E8E44'; }
}
function _startTimerTick() {
  // Persiste startMs+dur → reprise possible après fermeture de l'app
  try { localStorage.setItem(_TIMER_KEY, JSON.stringify({ startMs: Date.now() - _sesElapsed * 1000, dur: _sesDur })); } catch(e) {}
  _sesTimer = setInterval(() => {
    _sesElapsed++;
    const rem = _sesDur - _sesElapsed;
    _updateTimerDisplay(rem);
    _updateTimerHUD(rem, _sesDur);
    if (rem <= 0) { _stopTimer(); playBell(); setTimeout(playBell,2500); _doFadeStop(); }
  }, 1000);
}
function _stopTimer() {
  clearInterval(_sesTimer); _sesTimer = null;
  try { localStorage.removeItem(_TIMER_KEY); } catch(e) {}
  _updateTimerHUD(0, 0);
  const btn = document.getElementById('btn-timer-start');
  if (btn) { btn.textContent = '▶ Démarrer'; btn.style.color = ''; btn.style.borderColor = ''; }
}
function _resumeTimerIfNeeded() {
  try {
    const saved = JSON.parse(localStorage.getItem(_TIMER_KEY));
    if (!saved?.startMs || !saved?.dur) return;
    const elapsed = Math.floor((Date.now() - saved.startMs) / 1000);
    const remaining = saved.dur - elapsed;
    if (remaining <= 5) { localStorage.removeItem(_TIMER_KEY); return; }
    _sesDur = saved.dur; _sesElapsed = elapsed;
    _sesMins = Math.ceil(saved.dur / 60);
    _updateTimerDisplay(remaining);
    _updateTimerHUD(remaining, saved.dur);
    const btn = document.getElementById('btn-timer-start');
    if (btn) { btn.textContent = '■ Reprend'; btn.style.color = '#FFD060'; btn.style.borderColor = '#FFD06044'; }
    _startTimerTick();
  } catch(e) {}
}

function _updateTimerHUD(remaining, total) {
  const hud = document.getElementById('ses-timer-hud');
  const arc = document.getElementById('timer-arc');
  const pctEl = document.getElementById('timer-hud-pct');
  if (!hud) return;
  if (!total || remaining <= 0) {
    hud.classList.remove('active');
    return;
  }
  hud.classList.add('active');
  const pct = Math.max(0, Math.min(1, remaining / total));
  const circ = 113.1;
  if (arc) arc.setAttribute('stroke-dashoffset', (circ * (1 - pct)).toFixed(1));
  const color = pct > 0.5 ? '#86FFC0' : pct > 0.25 ? '#FFD060' : '#FF8E8E';
  if (arc) arc.setAttribute('stroke', color);
  if (pctEl) { pctEl.textContent = Math.ceil(pct * 100) + '%'; pctEl.style.color = color; }
}
function _updateTimerDisplay(seconds) {
  const el = document.getElementById('timer-display'); if (!el) return;
  if (seconds <= 0) { el.textContent = '— fin —'; return; }
  const m = Math.floor(seconds / 60), s = seconds % 60;
  el.textContent = String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
}
function _doFadeStop() {
  if (!flowing) return;
  const orig = masterVol, steps = 40;
  let i = 0;
  const fi = setInterval(() => {
    i++; setMasterVol(orig * (1 - i/steps));
    if (i >= steps) { clearInterval(fi); setTimeout(stopFlow, 200); setTimeout(() => setMasterVol(orig), 800); }
  }, 150);
}

// ── Bol Tibétain — toggle lecture continue ────────────────────────
function bowlToggle() {
  const btn = document.getElementById('btn-bowl-toggle');
  if (Bowl.playing) {
    Bowl.stop();
    if (btn) { btn.textContent = '▶ Démarrer'; btn.style.borderColor = '#86FFC0'; btn.style.color = '#86FFC0'; }
  } else {
    Bowl.start();
    if (btn) { btn.textContent = '■ Arrêter'; btn.style.borderColor = '#FF8E8E'; btn.style.color = '#FF8E8E'; }
  }
}

// ── FX state capture / restore (pour presets complets) ───────────
function _captureFXState() {
  const v = id => { const el = document.getElementById(id); return el ? parseFloat(el.value) : null; };
  const b = id => { const el = document.getElementById(id); return el ? el.checked : null; };
  return {
    eq: EQ_BANDS.map(band => ({ freq: band.freq, gain: band.gain })),
    delay:  { time: v('delayTime'),   feedback: v('delayFeedback'), wet: v('delayWet') },
    reverb: { wet: v('reverbWet') },
    pp:     { time: v('ppTime'),      feedback: v('ppFeedback'),    wet: v('ppWet') },
    comp:   { threshold: v('compThresh'), ratio: v('compRatio') },
    lfo:    { on: b('lfo-on'),   rate: v('lfo-rate'),   depth: v('lfo-depth') },
    breath: { on: b('breath-on'), rate: v('breath-rate'), depth: v('breath-depth') },
  };
}

function _restoreFXState(fx) {
  if (!fx) return;
  if (fx.eq) {
    const ids = [['eqLowFreq','eqLowGain'],['eqMidFreq','eqMidGain'],['eqHighFreq','eqHighGain']];
    fx.eq.forEach((b, i) => {
      if (b.freq != null) { const el = document.getElementById(ids[i][0]); if (el) el.value = b.freq; updateFX(ids[i][0], b.freq); }
      if (b.gain != null) { const el = document.getElementById(ids[i][1]); if (el) el.value = b.gain; updateFX(ids[i][1], b.gain); }
    });
    const cv = document.getElementById('eq2d-canvas'); if (cv) drawEQ2D(cv);
  }
  [['delayTime',fx.delay?.time],['delayFeedback',fx.delay?.feedback],['delayWet',fx.delay?.wet],
   ['reverbWet',fx.reverb?.wet],
   ['ppTime',fx.pp?.time],['ppFeedback',fx.pp?.feedback],['ppWet',fx.pp?.wet]]
  .forEach(([id, val]) => { if (val != null) { const el = document.getElementById(id); if (el) el.value = val; updateFX(id, val); } });
  if (fx.comp?.threshold != null) {
    const el = document.getElementById('compThresh'); if (el) el.value = fx.comp.threshold;
    setCompThresh(fx.comp.threshold);
    const vEl = document.getElementById('compThresh-val'); if (vEl) vEl.textContent = fx.comp.threshold + 'dB';
  }
  if (fx.comp?.ratio != null) {
    const el = document.getElementById('compRatio'); if (el) el.value = fx.comp.ratio;
    setCompRatio(fx.comp.ratio);
    const vEl = document.getElementById('compRatio-val'); if (vEl) vEl.textContent = fx.comp.ratio + ':1';
  }
  if (fx.lfo) {
    if (fx.lfo.rate  != null) { const el = document.getElementById('lfo-rate');  if (el) el.value = fx.lfo.rate;  lfoSet('rate', fx.lfo.rate); }
    if (fx.lfo.depth != null) { const el = document.getElementById('lfo-depth'); if (el) el.value = fx.lfo.depth; lfoSet('depth', fx.lfo.depth); }
    if (fx.lfo.on    != null) { const el = document.getElementById('lfo-on');    if (el) el.checked = fx.lfo.on;  lfoToggle(fx.lfo.on); }
  }
  if (fx.breath) {
    if (fx.breath.rate  != null) { const el = document.getElementById('breath-rate');  if (el) el.value = fx.breath.rate;  breathSet('rate', fx.breath.rate); }
    if (fx.breath.depth != null) { const el = document.getElementById('breath-depth'); if (el) el.value = fx.breath.depth; breathSet('depth', fx.breath.depth); }
    if (fx.breath.on    != null) { const el = document.getElementById('breath-on');    if (el) el.checked = fx.breath.on;  breathToggle(fx.breath.on); }
  }
}

// ── Presets de session ────────────────────────────────────────────
const PS_KEY = 'fbf432-session-presets';
let _sessionPresets = [null, null, null, null, null];

function _loadSessionPresets() {
  try {
    const p = JSON.parse(localStorage.getItem(PS_KEY));
    if (Array.isArray(p)) _sessionPresets = p;
  } catch(e) {}
  _renderPresets();
}

function savePreset(slot) {
  const name = window.prompt('Nom du preset :', _sessionPresets[slot]?.name || 'Preset '+(slot+1));
  if (!name) return;
  _sessionPresets[slot] = {
    name, masterFreq, globalDelta, masterVol,
    pairs: PAIRS.map(p => ({
      ri:p.pingala.ri, n:p.pingala.n, vp:p.pingala.vol,
      dt:p.ida.delta, po:p.ida.polarity, vi:p.ida.vol
    })),
    fx: _captureFXState()
  };
  try { localStorage.setItem(PS_KEY, JSON.stringify(_sessionPresets)); } catch(e) {}
  _renderPresets();
}

function loadPreset(slot) {
  const p = _sessionPresets[slot]; if (!p) return;
  if (p.masterFreq>=36 && p.masterFreq<=864) setMasterFreq(p.masterFreq);
  if (p.globalDelta>0) setGlobalDelta(p.globalDelta);
  if (p.masterVol>=0)  setMasterVol(p.masterVol);
  (p.pairs||[]).forEach((sp,i) => {
    if (!PAIRS[i]) return;
    if (sp.ri>=0 && sp.ri<RATIO_OPTS.length) PAIRS[i].pingala.ri = sp.ri;
    if (!isNaN(sp.n) && sp.n>0) PAIRS[i].pingala.n = sp.n;
    if (sp.vp>=0) PAIRS[i].pingala.vol = sp.vp;
    if (sp.dt>0)  PAIRS[i].ida.delta   = sp.dt;
    if (sp.po===1||sp.po===-1) PAIRS[i].ida.polarity = sp.po;
    if (sp.vi>=0) PAIRS[i].ida.vol = sp.vi;
  });
  updateDisplay();
  if (flowing) PAIRS.forEach((_,i) => { tuneOsc(PAIRS[i].pingala.id,calcPFreq(i)); tuneOsc(PAIRS[i].ida.id,calcIFreq(i)); });
  if (p.fx) _restoreFXState(p.fx);
  saveState();
}

function delPreset(slot) {
  _sessionPresets[slot] = null;
  try { localStorage.setItem(PS_KEY, JSON.stringify(_sessionPresets)); } catch(e) {}
  _renderPresets();
}

function _renderPresets() {
  _sessionPresets.forEach((p, s) => {
    const nameEl = document.getElementById('ps-name-'+s);
    if (nameEl) nameEl.textContent = p?.name || '— Vide —';
    const loadEl = document.getElementById('ps-load-'+s);
    if (loadEl) loadEl.disabled = !p;
    const delEl = document.getElementById('ps-del-'+s);
    if (delEl) delEl.disabled = !p;
  });
}

// ── Init ──────────────────────────────────────────────────────────
function init() {
  loadState();

  // Inject FX panel
  const fxBody = document.getElementById('panel-fx-body');
  if (fxBody) {
    fxBody.innerHTML = buildMasterFXHTML();
    requestAnimationFrame(() => initEQ2D(document.getElementById('eq2d-canvas')));
  }

  // Inject progression into random panel
  const progWrap = document.getElementById('rand-prog-wrap');
  if (progWrap) progWrap.innerHTML = buildProgHTML();

  // Load session presets
  _loadSessionPresets();

  // Reprend la minuterie si l'app a été fermée en cours de session
  _resumeTimerIfNeeded();

  // Build vesica spheres
  buildVesicaPairs();

  // Build random table
  buildRandomTable();

  // Inject Bowl panel
  const bowlBody = document.getElementById('bowl-panel-body');
  if (bowlBody) bowlBody.innerHTML = buildBowlHTML();

  // Initialise les 18 fonds d'écran (+ restaure le dernier choisi)
  initBackgrounds();

  // Démarre la Sphère Solaire Mandala (fond génératif SVG 3D)
  initSolarSphere();

  // Démarre la boucle de visualisation audio (spectroïde + halo sphère)
  masterTick();

  // Sync global delta
  setGlobalDelta(globalDelta);

  // Sync UI state
  updateDisplay();
  patchFBFState();
  updateInfobar();

  // Infobar tick indépendant (1s)
  setInterval(updateInfobar, 1000);

  ui('idle', 'Prêt · Touchez la sphère pour rayonner');
}

// ── Patch affichage sphère — hooks updateDisplay / patchFBFState ──
// Exécuté après chargement de tous les scripts
(function patchSphereHooks() {
  const _uD = window.updateDisplay;
  const _pF = window.patchFBFState;
  window.updateDisplay = function() {
    _uD && _uD();
    typeof updateSphereDisplay === 'function' && updateSphereDisplay();
    document.title = '0mcha396 · ' + masterFreq + ' Hz';
  };
  window.patchFBFState = function() {
    _pF && _pF();
    typeof updateSphereDisplay === 'function' && updateSphereDisplay();
    typeof setSolarBreathing === 'function' && setSolarBreathing(!!flowing);
  };
})();

// ── Deux orientations supportées (app Android : paysage + portrait) ──
function _checkOrientation() {
  const ov = document.getElementById('rotate-overlay');
  if (ov) ov.style.display = 'none';               // plus de blocage d'orientation
  try { screen.orientation.unlock(); } catch(e) {}
}
window.addEventListener('resize', _checkOrientation);
window.addEventListener('orientationchange', _checkOrientation);

function launchInit() {
  let done = false;
  function go() { if (done) return; done=true; setTimeout(init, 60); }
  try { document.fonts.ready.then(go); } catch(e) {}
  setTimeout(go, 800);
  _checkOrientation();
}

if (document.readyState==='complete') { launchInit(); }
else { window.addEventListener('load', launchInit); }

window.addEventListener('resize', () => setTimeout(() => {
  if (masterRAF) { cancelAnimationFrame(masterRAF); masterRAF=null; }
  buildVesicaPairs();
  masterTick();
}, 150));

document.addEventListener('keydown', e => {
  if (e.target.tagName==='INPUT'||e.target.tagName==='SELECT'||e.target.tagName==='TEXTAREA') return;
  if (e.code==='Space')  { e.preventDefault(); fbfToggle(); }
  if (e.code==='Escape') { closeOscModal(); closePanel(); }
});

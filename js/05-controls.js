/* ═══════════════════════════════════════════
   05-controls.js — Contrôles 0mcha396 & oscillateurs
   ═══════════════════════════════════════════ */

// ── Trigger 0mcha396 — mode full aléatoire binaural ─────────────────
// Band A (36–108) : oscs 0,1
// Band B (108–256): oscs 2,3
// Band C (256–432): oscs 4,5
// Maître : aléatoire 36–432
function trigger0mcha396() {
  masterFreq = 36 + Math.floor(Math.random() * 397);

  PAIRS[0].pingala.baseFreq = 36  + Math.floor(Math.random() * 72);
  PAIRS[1].pingala.baseFreq = 36  + Math.floor(Math.random() * 72);
  PAIRS[2].pingala.baseFreq = 108 + Math.floor(Math.random() * 148);
  PAIRS[3].pingala.baseFreq = 108 + Math.floor(Math.random() * 148);
  PAIRS[4].pingala.baseFreq = 256 + Math.floor(Math.random() * 176);
  PAIRS[5].pingala.baseFreq = 256 + Math.floor(Math.random() * 176);
  PAIRS[7].pingala.baseFreq = 432 + Math.floor(Math.random() * 216);
  PAIRS[8].pingala.baseFreq = 432 + Math.floor(Math.random() * 216);

  // Volumes selon point d'observation toroïdal
  const zVols = TORUS_ZOOMS[zoomLevel].bandVols;
  for (let i = 0; i < MASTER_IDX; i++) { PAIRS[i].pingala.vol = zVols[i]; PAIRS[i].ida.vol = zVols[i]; }
  PAIRS[MASTER_IDX].pingala.vol = .14; PAIRS[MASTER_IDX].ida.vol = .14;
  PAIRS[7].pingala.vol = .06; PAIRS[7].ida.vol = .06;
  PAIRS[8].pingala.vol = .06; PAIRS[8].ida.vol = .06;

  if (typeof flowing !== 'undefined' && flowing) {
    PAIRS.forEach((_, i) => {
      tuneOsc(PAIRS[i].pingala.id, calcPFreq(i));
      tuneOsc(PAIRS[i].ida.id,     calcIFreq(i));
    });
  } else {
    startFlow();
  }

  // FX aléatoire
  randomizeFX();

  // Cycle couleur de la sphère
  _sphereColorIdx = (_sphereColorIdx + 1) % SPHERE_COLORS_12.length;

  updateDisplay();
  saveState();
}

// ── Bouton +/− sur la sphère : ±36 Hz maître + ratio aléatoire pour chaque osc ──
function fbfStep(delta) {
  masterFreq = Math.max(36, Math.min(432, masterFreq + delta));

  for (let i = 0; i < MASTER_IDX; i++) {
    const ratio = RATIO_OPTS[Math.floor(Math.random() * RATIO_OPTS.length)].r;
    PAIRS[i].pingala.baseFreq = Math.max(36, Math.min(432,
      PAIRS[i].pingala.baseFreq + delta * ratio));
    if (typeof flowing !== 'undefined' && flowing) {
      tuneOsc(PAIRS[i].pingala.id, calcPFreq(i));
      tuneOsc(PAIRS[i].ida.id,     calcIFreq(i));
    }
  }
  if (typeof flowing !== 'undefined' && flowing) {
    tuneOsc(PAIRS[MASTER_IDX].pingala.id, masterFreq);
    tuneOsc(PAIRS[MASTER_IDX].ida.id,     calcIFreq(MASTER_IDX));
  }

  updateDisplay();
  saveState();
}

// ── Options mode aléatoire (pour compatibilité panel FX) ──────────
const RAND_OPTS = {freqMin:36, freqMax:432, ratioMode:'random', useFX:false, rangeOn:false};
function setRandRange(v)    { RAND_OPTS.rangeOn = !!v; }
function setRandFreqMin(v)  {
  RAND_OPTS.freqMin = Math.max(36, Math.min(RAND_OPTS.freqMax-1, parseInt(v)));
  const el=document.getElementById('rv-fmin'); if(el) el.textContent=RAND_OPTS.freqMin;
}
function setRandFreqMax(v)  {
  RAND_OPTS.freqMax = Math.min(432, Math.max(RAND_OPTS.freqMin+1, parseInt(v)));
  const el=document.getElementById('rv-fmax'); if(el) el.textContent=RAND_OPTS.freqMax;
}
function setRandRatioMode(m, btn) {
  RAND_OPTS.ratioMode = m;
  document.querySelectorAll('[id^="rrm-"]').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}
function setRandUseFX(v) { RAND_OPTS.useFX = !!v; }

// ── FX aléatoire (mobile-safe) ──────────────────────────────────────
function randomizeFX() {
  // Tout sur mobile (APK) : pas de reverb, delay léger, EQ doux, chorus off
  const delT  = +(0.15 + Math.random() * .5).toFixed(2);
  const delFB = +(Math.random() * .3).toFixed(2);
  const delW  = +(Math.random() * .12).toFixed(2);  // max 12% — évite les saturations
  const revW  = 0;                                   // reverb toujours off (coût CPU)
  const eqLF  = Math.round(80  + Math.random() * 200);
  const eqLG  = Math.round((Math.random() * 6 - 3) * 10) / 10;   // ±3 dB max
  const eqMF  = Math.round(400 + Math.random() * 2000);
  const eqMG  = Math.round((Math.random() * 6 - 3) * 10) / 10;
  const eqHF  = Math.round(4000 + Math.random() * 6000);
  const eqHG  = Math.round((Math.random() * 6 - 3) * 10) / 10;
  const ppT   = +(0.1 + Math.random() * .4).toFixed(2);           // ping pong 0.1–0.5s
  const ppFB  = +(Math.random() * .4).toFixed(2);
  const ppW   = +(Math.random() * .2).toFixed(2);                 // max 20% mix
  [['eqLowFreq',eqLF],['eqLowGain',eqLG],['eqMidFreq',eqMF],['eqMidGain',eqMG],
   ['eqHighFreq',eqHF],['eqHighGain',eqHG],['delayTime',delT],['delayFeedback',delFB],
   ['delayWet',delW],['reverbWet',revW],['ppTime',ppT],['ppFeedback',ppFB],['ppWet',ppW]
  ].forEach(([id,val]) => {
    const sl = document.getElementById(id); if (sl) sl.value = val;
    if (typeof updateFX === 'function') updateFX(id, val);
  });
  // Chorus désactivé sur mobile (source principale de craquement)
  if (typeof chorus !== 'undefined' && chorus) {
    try { chorus.depth = 0; chorus.wet.value = 0; } catch(e) {}
  }
  // Respiration : activée aléatoirement (40% chance), rythme méditation 4.8–15 /min
  const breathOn    = Math.random() < 0.4;
  const breathRate  = +(0.08 + Math.random() * 0.17).toFixed(3);
  const breathDepth = +(0.1  + Math.random() * 0.40).toFixed(2);
  const brEl = document.getElementById('breath-rate');
  const bdEl = document.getElementById('breath-depth');
  const boEl = document.getElementById('breath-on');
  if (brEl) { brEl.value = breathRate;  if (typeof breathSet==='function') breathSet('rate', breathRate); }
  if (bdEl) { bdEl.value = breathDepth; if (typeof breathSet==='function') breathSet('depth', breathDepth); }
  if (boEl) { boEl.checked = breathOn;  if (typeof breathToggle==='function') breathToggle(breathOn); }
}

// ── Contrôles individuels oscillateurs ─────────────────────────────
function setN(i, raw) {
  const n = Math.round(Math.max(0.1, parseFloat(raw)) * 10) / 10;
  if (isNaN(n)) return;
  PAIRS[i].pingala.n = n;
  updatePairUI(i);
  if (typeof flowing !== 'undefined' && flowing) {
    tuneOsc(PAIRS[i].pingala.id, calcPFreq(i));
    tuneOsc(PAIRS[i].ida.id,     calcIFreq(i));
  }
  saveState();
}
function setRatio(i, ri) {
  PAIRS[i].pingala.ri = ri;
  if (typeof flowing !== 'undefined' && flowing) swapPingala(i); else updatePairUI(i);
  saveState();
}
function setDelta(i, raw) {
  const d = Math.round(Math.max(0.1, Math.min(36, parseFloat(raw))) * 10) / 10;
  if (isNaN(d)) return;
  PAIRS[i].ida.delta = d;
  updatePairUI(i);
  if (typeof flowing !== 'undefined' && flowing) swapIDebounced(i);
  saveState();
}
function togglePolarity(i) {
  PAIRS[i].ida.polarity *= -1;
  if (typeof flowing !== 'undefined' && flowing) swapIda(i); else updatePairUI(i);
  saveState();
}
function toggleMuteP(i) {
  const pid = PAIRS[i].pingala.id;
  mutedOscs[pid] = !mutedOscs[pid];
  const node = nodes[pid];
  if (node) safeRamp(node.g.gain, mutedOscs[pid] ? 0 : PAIRS[i].pingala.vol, 0.5);
  updatePairUI(i); saveState();
}
function toggleMuteI(i) {
  const iid = PAIRS[i].ida.id;
  mutedOscs[iid] = !mutedOscs[iid];
  const node = nodes[iid];
  if (node) safeRamp(node.g.gain, mutedOscs[iid] ? 0 : PAIRS[i].ida.vol, 0.5);
  updatePairUI(i); if (typeof updateMasterState==='function') updateMasterState(); saveState();
}
function setVolP(i, vol) {
  PAIRS[i].pingala.vol = vol;
  const pid = PAIRS[i].pingala.id;
  const d = document.getElementById('o-pvol-'+i); if (d) d.textContent = vol.toFixed(2);
  const node = nodes[pid]; if (node && !mutedOscs[pid]) safeRamp(node.g.gain, vol, 0.3);
  saveState();
}
function setVolI(i, vol) {
  PAIRS[i].ida.vol = vol;
  const iid = PAIRS[i].ida.id;
  const d = document.getElementById('o-ivol-'+i); if (d) d.textContent = vol.toFixed(2);
  const node = nodes[iid]; if (node && !mutedOscs[iid]) safeRamp(node.g.gain, vol, 0.3);
  saveState();
}
function setMasterVol(v) {
  masterVol = Math.max(0, Math.min(1, parseFloat(v)));
  if (typeof masterGain !== 'undefined' && masterGain) safeRamp(masterGain.gain, masterVol, 0.3);
  const d = document.getElementById('mvol-val');
  if (d) d.textContent = Math.round(masterVol * 100) + '%';
  saveState();
}
function setMasterFreq(f) {
  masterFreq = Math.max(36, Math.min(432, f));
  updateDisplay();
  if (typeof flowing !== 'undefined' && flowing) PAIRS.forEach((_, i) => {
    tuneOsc(PAIRS[i].pingala.id, calcPFreq(i));
    tuneOsc(PAIRS[i].ida.id,     calcIFreq(i));
  });
  saveState();
}

function deltaStep(delta) {
  setGlobalDelta(Math.round(Math.max(0.1, Math.min(36, globalDelta + delta)) * 10) / 10);
}
function setGlobalDelta(raw) {
  const d = Math.round(Math.max(0.1, Math.min(36, parseFloat(raw))) * 10) / 10;
  if (isNaN(d)) return;
  globalDelta = d;
  PAIRS.forEach((pair, i) => {
    pair.ida.delta = d;
    updatePairUI(i);
    if (typeof flowing !== 'undefined' && flowing) tuneOsc(pair.ida.id, calcIFreq(i));
  });
  const ws  = waveState(d);
  const gws = document.getElementById('global-ws');
  if (gws) { gws.textContent = ws.s; gws.style.color = ws.c; }
  const gdi = document.getElementById('global-delta-input');
  if (gdi && document.activeElement !== gdi) gdi.value = d.toFixed(1);
  saveState();
}

function nDecrement(i) { setN(i, Math.max(0.1, Math.round((PAIRS[i].pingala.n - 0.1)*10)/10)); }
function nIncrement(i) { setN(i, Math.round((PAIRS[i].pingala.n + 0.1)*10)/10); }
function nReset(i) {
  PAIRS[i].pingala.n = (i === MASTER_IDX) ? 1.0 : 0.2 + (i * 0.5);
  updatePairUI(i);
  if (typeof flowing !== 'undefined' && flowing) swapPDebounced(i);
}
function nRandom(i) {
  PAIRS[i].pingala.n = Math.round((0.1 + Math.random() * 5.0) * 10) / 10;
  updatePairUI(i);
  if (typeof flowing !== 'undefined' && flowing) swapPDebounced(i);
}

function masterStep(delta) {
  setMasterFreq(Math.max(36, Math.min(432, masterFreq + delta)));
}
function onMasterInput(raw) {
  const v = parseInt(raw);
  if (isNaN(v) || v < 36 || v > 432) return;
  masterFreq = v;
  const msf = document.getElementById('ms-freq'); if (msf) msf.textContent = v;
  document.title = '0mcha396 · ' + v;
  PAIRS.forEach((pair, i) => {
    if (typeof flowing !== 'undefined' && flowing) {
      tuneOsc(pair.pingala.id, calcPFreq(i));
      tuneOsc(pair.ida.id, calcIFreq(i));
    }
  });
  updateSphereDisplay && updateSphereDisplay();
}
function onMasterChange(raw) {
  const v = Math.max(36, Math.min(432, parseInt(raw)));
  if (!isNaN(v)) setMasterFreq(v);
}

// FBF toggle flux
function fbfToggle() {
  if (typeof flowing !== 'undefined' && flowing) stopFlow(); else startFlow();
}

// ── Flux Toroïdal — point d'observation ──────────────────────────
function applyZoom() {
  const z = TORUS_ZOOMS[zoomLevel];
  for (let i = 0; i < MASTER_IDX; i++) {
    PAIRS[i].pingala.vol = z.bandVols[i];
    PAIRS[i].ida.vol     = z.bandVols[i];
    if (typeof nodes !== 'undefined') {
      const pid = PAIRS[i].pingala.id, iid = PAIRS[i].ida.id;
      if (!mutedOscs[pid] && nodes[pid]) safeRamp(nodes[pid].g.gain, z.bandVols[i], 1.2);
      if (!mutedOscs[iid] && nodes[iid]) safeRamp(nodes[iid].g.gain, z.bandVols[i], 1.2);
    }
  }
  updateDisplay();
  saveState();
}

// Alias pour compatibilité panel FX / raccourci clavier
function triggerMagicAuto() { trigger0mcha396(); }

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

function resetAll() {
  if (typeof flowing !== 'undefined' && flowing) return;
  masterFreq = 252; globalDelta = 1.8; masterVol = 0.8;
  PAIRS.forEach((p, i) => {
    p.pingala.ri = i % RATIO_OPTS.length;
    p.pingala.n  = (i === MASTER_IDX) ? 1.0 : 0.2 + (i * 0.5);
    p.pingala.vol = .12; p.ida.delta = 1.8; p.ida.polarity = 1; p.ida.vol = .12;
    mutedOscs[p.pingala.id] = false; mutedOscs[p.ida.id] = false;
  });
  PAIRS[MASTER_IDX].pingala.vol = .14; PAIRS[MASTER_IDX].ida.vol = .14;
  PAIRS[7].pingala.vol = .06; PAIRS[7].ida.vol = .06;
  PAIRS[8].pingala.vol = .06; PAIRS[8].ida.vol = .06;
  // Réinitialise baseFreq aux valeurs de bande par défaut
  PAIRS[0].pingala.baseFreq = 63;  PAIRS[1].pingala.baseFreq = 81;
  PAIRS[2].pingala.baseFreq = 162; PAIRS[3].pingala.baseFreq = 192;
  PAIRS[4].pingala.baseFreq = 288; PAIRS[5].pingala.baseFreq = 324;
  PAIRS[6].pingala.baseFreq = 252;
  PAIRS[7].pingala.baseFreq = 486; PAIRS[8].pingala.baseFreq = 576;
  try { localStorage.removeItem(LS_KEY); } catch(e) {}
  const mvs = document.getElementById('mvol-slider'); if (mvs) mvs.value = 0.8;
  const mvv = document.getElementById('mvol-val');    if (mvv) mvv.textContent = '80%';
  updateDisplay();
  setGlobalDelta(1.8);
}

/* ═══════════════════════════════════════════
   04-vesica-ui.js — Sphère 0mcha396 (bulle unique)
   ═══════════════════════════════════════════ */

// Détection tap court vs long press sur la sphère
var _sphTimer = null, _sphFired = false;

function _sphStart(e) {
  if (e.type === 'touchstart') { try { e.preventDefault(); } catch(x) {} }
  _sphFired = false;
  clearTimeout(_sphTimer);
  _sphTimer = setTimeout(() => {
    _sphFired = true; _sphTimer = null;
    trigger0mcha396(); // long press = re-random
  }, 500);
}
function _sphEnd() {
  if (_sphTimer) {
    clearTimeout(_sphTimer); _sphTimer = null;
    if (!_sphFired) fbfSpherePress(); // tap court
  }
}
function _sphCancel() { clearTimeout(_sphTimer); _sphTimer = null; }

// Calcule le style inline de la bulle (planète 3D avec volume et reflets)
function _sphereStyle(color) {
  return {
    borderColor: color + '66',
    background: `radial-gradient(circle at 34% 28%,
      rgba(255,255,255,.92) 0%,
      rgba(255,255,255,.55) 4%,
      ${color}CC 12%,
      ${color}88 30%,
      ${color}44 55%,
      rgba(0,0,0,.74) 100%)`,
    boxShadow: `0 0 90px ${color}44, 0 0 44px ${color}22,
      inset 0 0 70px ${color}22,
      inset -20px -20px 42px rgba(0,0,0,.62),
      0 18px 55px rgba(0,0,0,.72)`
  };
}

function _applyStyle(el, color) {
  const s = _sphereStyle(color);
  el.style.borderColor = s.borderColor;
  el.style.background  = s.background;
  el.style.boxShadow   = s.boxShadow;
}

// Construit la sphère unique centrée
function buildVesicaPairs() {
  const layer = document.getElementById('sphere-layer');
  if (!layer) return;
  layer.innerHTML = '';

  const color = SPHERE_COLORS_12[_sphereColorIdx];

  const wrap = document.createElement('div');
  wrap.id = 'fbf-sphere-wrap';

  const sphere = document.createElement('div');
  sphere.id = 'fbf-sphere';
  sphere.className = 'fbf-bubble' + (flowing ? ' sph-flowing' : '');
  _applyStyle(sphere, color);

  sphere.innerHTML = `
    <div class="sph-shine"></div>
    <div class="sph-content">
      <div class="sph-label">0mcha396</div>
      <div class="sph-freq" id="sphere-freq">${masterFreq}</div>
      <div class="sph-zoom" id="sphere-zoom">${TORUS_ZOOMS[zoomLevel].icon} ${TORUS_ZOOMS[zoomLevel].name}</div>
      <div class="sph-sub" id="sphere-sub">Press &amp; Destress</div>
    </div>`;

  sphere.addEventListener('mousedown',  _sphStart);
  sphere.addEventListener('mouseup',    _sphEnd);
  sphere.addEventListener('mouseleave', _sphCancel);
  sphere.addEventListener('touchstart', _sphStart, {passive:false});
  sphere.addEventListener('touchend',   _sphEnd);

  const btnPlus = document.createElement('button');
  btnPlus.className = 'sph-btn sph-plus';
  btnPlus.textContent = '+';
  btnPlus.addEventListener('click', e => { e.stopPropagation(); fbfStep(36); });

  const btnMinus = document.createElement('button');
  btnMinus.className = 'sph-btn sph-minus';
  btnMinus.textContent = '−';
  btnMinus.addEventListener('click', e => { e.stopPropagation(); fbfStep(-36); });

  wrap.appendChild(sphere);
  wrap.appendChild(btnPlus);
  wrap.appendChild(btnMinus);
  layer.appendChild(wrap);
}

// Met à jour l'affichage de la sphère (fréquence, couleur, état flux)
function updateSphereDisplay() {
  const freqEl = document.getElementById('sphere-freq');
  if (freqEl) freqEl.textContent = masterFreq;

  const zoomEl = document.getElementById('sphere-zoom');
  if (zoomEl) { const z = TORUS_ZOOMS[zoomLevel]; zoomEl.textContent = z.icon + ' ' + z.name; }

  const sphere = document.getElementById('fbf-sphere');
  if (!sphere) return;

  const isFlowing = typeof flowing !== 'undefined' && flowing;
  sphere.classList.toggle('sph-flowing', isFlowing);
  const ftb = document.getElementById('flux-toggle-btn');
  const fti = document.getElementById('flux-toggle-ico');
  if (ftb) ftb.classList.toggle('live', isFlowing);
  if (fti) fti.textContent = isFlowing ? '■' : '▶';

  _applyStyle(sphere, SPHERE_COLORS_12[_sphereColorIdx]);
}

// Tap court = cycle zoom si flux actif ; sinon démarre
function fbfSpherePress() {
  if (typeof flowing !== 'undefined' && flowing) {
    zoomLevel = (zoomLevel + 1) % TORUS_ZOOMS.length;
    applyZoom();
    updateSphereDisplay();
  } else {
    trigger0mcha396();
  }
}

// Stubs de compatibilité (remplaçants des fonctions Vesica multi-sphères)
function updatePairUI(i) {
  // Mise à jour éléments modal oscillateur (silencieuse si éléments absents)
  const pair = PAIRS[i];
  const pF = calcPFreq(i), iF = calcIFreq(i);
  const ws = waveState(pair.ida.delta);
  ['pfreq-'+i,'bfr-'+i].forEach(id => { const e=document.getElementById(id); if(e) e.textContent=fmtFreq(pF); });
  ['ifreq-'+i,'ibf-r-'+i].forEach(id => { const e=document.getElementById(id); if(e) e.textContent=fmtFreq(iF); });
  const bws=document.getElementById('bws-'+i); if(bws){bws.textContent=ws.s;bws.style.color=ws.c;}
  updateOrbUI(i);
}

function updateOrbUI(i) {
  if (typeof patchFBFState === 'function') patchFBFState();
}

function openFreqEdit() {}
function handleFreqKey(e) {}
function exitEditMaster() {}
function toggleAccord(id) {
  const body  = document.getElementById('ab-'+id);
  const arrow = document.getElementById('aa-'+id);
  if (!body || !arrow) return;
  const open = body.classList.toggle('open');
  arrow.classList.toggle('open', open);
}

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

// Calcule le style inline de la bulle selon la couleur active
function _sphereStyle(color) {
  return {
    borderColor: color + 'BB',
    background: `radial-gradient(circle at 35% 28%,
      rgba(255,255,255,.88) 0%,
      rgba(255,255,255,.45) 5%,
      ${color}AA 18%,
      ${color}77 44%,
      ${color}33 68%,
      rgba(8,2,24,.55) 88%)`,
    boxShadow: `0 0 90px ${color}55,0 0 44px ${color}33,
      inset 0 0 65px ${color}18,
      inset 28px 28px 52px rgba(255,255,255,.13)`
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

  const sphere = document.getElementById('fbf-sphere');
  if (!sphere) return;

  const isFlowing = typeof flowing !== 'undefined' && flowing;
  sphere.classList.toggle('sph-flowing', isFlowing);

  _applyStyle(sphere, SPHERE_COLORS_12[_sphereColorIdx]);
}

// Tap court = toggle flux ; si on démarre → random complet
function fbfSpherePress() {
  if (typeof flowing !== 'undefined' && flowing) {
    stopFlow();
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

/* ═══════════════════════════════════════════
   03-backgrounds.js — 18 Fonds d'écran (.png) + dégradés de secours
   ───────────────────────────────────────────
   Système 100 % hors-ligne. Les vraies images vivent en local dans
   img/bg-01.png … img/bg-18.png. Tant qu'un fichier est absent, un
   dégradé cosmique de secours s'affiche → l'écran reste beau AVANT
   même que les photos soient déposées. Dès qu'un .png existe, il
   remplace automatiquement le dégradé (aucune config à faire).
   ═══════════════════════════════════════════ */
'use strict';

const BG_COUNT = 18;
const BG_KEY   = 'omcha-bg-idx';

// 18 dégradés de secours générés par teinte (palette géométrie sacrée).
const BG_GRAD = Array.from({ length: BG_COUNT }, (_, i) => {
  const h  = Math.round(i * 360 / BG_COUNT);
  const h2 = (h + 42) % 360;
  return `radial-gradient(circle at 28% 22%, hsl(${h2},70%,30%), transparent 60%),`
       + `radial-gradient(circle at 78% 82%, hsl(${h},66%,24%), transparent 55%),`
       + `linear-gradient(158deg, hsl(${h},55%,9%), #02010D 82%)`;
});

let _bgIdx = 0;

function _bgFile(i) { return `img/bg-${String(i + 1).padStart(2, '0')}.png`; }

// Affiche le fond i : dégradé de secours immédiat, puis le vrai .png s'il existe.
function setBackground(i) {
  _bgIdx = ((i % BG_COUNT) + BG_COUNT) % BG_COUNT;
  const el = document.getElementById('cosmic-bg');
  if (el) {
    el.style.backgroundImage = BG_GRAD[_bgIdx];
    const url = _bgFile(_bgIdx);
    const probe = new Image();
    probe.onload  = () => { el.style.backgroundImage = `url("${url}")`; };
    probe.onerror = () => {};   // garde le dégradé de secours
    probe.src = url;
  }
  document.querySelectorAll('.bg-thumb').forEach((t, k) => t.classList.toggle('active', k === _bgIdx));
  try { localStorage.setItem(BG_KEY, _bgIdx); } catch (e) {}
}
function nextBackground() { setBackground(_bgIdx + 1); }
function prevBackground() { setBackground(_bgIdx - 1); }

// Construit la grille de 18 vignettes (dégradé, remplacé par le .png si présent).
function buildBgGrid() {
  const grid = document.getElementById('bg-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (let i = 0; i < BG_COUNT; i++) {
    const b = document.createElement('button');
    b.className = 'bg-thumb';
    b.style.backgroundImage = BG_GRAD[i];
    b.setAttribute('aria-label', 'Fond ' + (i + 1));
    b.onclick = () => setBackground(i);
    const num = document.createElement('span');
    num.className = 'bg-thumb-num';
    num.textContent = i + 1;
    b.appendChild(num);
    grid.appendChild(b);
    // remplace la vignette par la vraie image si elle existe
    const url = _bgFile(i), probe = new Image();
    probe.onload = () => { b.style.backgroundImage = `url("${url}")`; };
    probe.src = url;
  }
  document.querySelectorAll('.bg-thumb').forEach((t, k) => t.classList.toggle('active', k === _bgIdx));
}

function initBackgrounds() {
  let saved = 0;
  try { saved = parseInt(localStorage.getItem(BG_KEY)) || 0; } catch (e) {}
  buildBgGrid();
  setBackground(saved);
}

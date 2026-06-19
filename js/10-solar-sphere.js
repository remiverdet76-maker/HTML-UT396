/* ═══════════════════════════════════════════
   10-solar-sphere.js — Sphère Solaire Mandala
   Génératif SVG · 6 palettes · respiration flux
   ═══════════════════════════════════════════ */
'use strict';

const _SVG_NS = 'http://www.w3.org/2000/svg';
const _SC = 500; // centre du viewBox 1000×1000

// ── 6 palettes de couleurs ────────────────────────────────────────
const SOLAR_PALETTES = [
  { name:'Solaire',  light:'#FFFDF4', mid:'#FFE9A8', main:'#F6B73C', dark:'#C8791A', deep:'#9A4E0E', ray:'#F6B73C' },
  { name:'Cosmos',   light:'#F5EEFF', mid:'#D8AAFF', main:'#A855F7', dark:'#7C3AED', deep:'#4C1D95', ray:'#C084FC' },
  { name:'Aqua',     light:'#E0FFFF', mid:'#7FF7FF', main:'#22D3EE', dark:'#0E7490', deep:'#164E63', ray:'#67E8F9' },
  { name:'Emeraude', light:'#ECFDF5', mid:'#A7F3D0', main:'#10B981', dark:'#065F46', deep:'#022C22', ray:'#6EE7B7' },
  { name:'Feu',      light:'#FFF7F0', mid:'#FFBA80', main:'#F97316', dark:'#C2410C', deep:'#7C2D12', ray:'#FB923C' },
  { name:'Sidéral',  light:'#EEF2FF', mid:'#A5B4FC', main:'#6366F1', dark:'#3730A3', deep:'#1E1B4B', ray:'#818CF8' },
];

const _SOL_PAL_KEY = 'omcha-solar-palette';
let _solarPaletteIdx = 0;
try { _solarPaletteIdx = Math.max(0, parseInt(localStorage.getItem(_SOL_PAL_KEY)) || 0) % SOLAR_PALETTES.length; } catch(e) {}

function _sPal() { return SOLAR_PALETTES[_solarPaletteIdx % SOLAR_PALETTES.length]; }

// ── Helpers SVG ───────────────────────────────────────────────────
let _solarDefsBuilt = false;

function _makeCouche(cls) {
  const wrap = document.createElement('div');
  wrap.className = 'solar-couche ' + cls;
  const s = document.createElementNS(_SVG_NS, 'svg');
  s.setAttribute('viewBox', '0 0 1000 1000');
  wrap.appendChild(s);
  document.getElementById('solar-sphere').appendChild(wrap);
  return s;
}

function _svgAdd(parent, tag, attrs) {
  const el = document.createElementNS(_SVG_NS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  parent.appendChild(el);
  return el;
}

// Les defs SVG (gradients) sont définis une seule fois dans le premier SVG
// et référencés par ID depuis tous les autres (portée document HTML)
function _buildDefs(svg, p) {
  if (_solarDefsBuilt) return;
  _solarDefsBuilt = true;
  const d = document.createElementNS(_SVG_NS, 'defs');
  d.innerHTML = `
    <radialGradient id="sOr" cx="40%" cy="35%" r="75%">
      <stop offset="0%"   stop-color="${p.light}"/>
      <stop offset="22%"  stop-color="${p.mid}"/>
      <stop offset="55%"  stop-color="${p.main}"/>
      <stop offset="82%"  stop-color="${p.dark}"/>
      <stop offset="100%" stop-color="${p.deep}"/>
    </radialGradient>
    <radialGradient id="sNoyau" cx="45%" cy="40%" r="70%">
      <stop offset="0%"   stop-color="#FFFFFF"/>
      <stop offset="35%"  stop-color="${p.mid}"/>
      <stop offset="100%" stop-color="${p.main}"/>
    </radialGradient>
    <linearGradient id="sRayon" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="${p.ray}" stop-opacity="0"/>
      <stop offset="55%"  stop-color="${p.ray}" stop-opacity=".78"/>
      <stop offset="100%" stop-color="${p.mid}"/>
    </linearGradient>`;
  svg.appendChild(d);
}

// ── Couches géométriques ──────────────────────────────────────────

function _buildRayons(p) {
  const s = _makeCouche('solar-rayons');
  _buildDefs(s, p);
  for (let i = 0; i < 48; i++) {
    const a = (360 / 48) * i;
    const long = i % 2 ? 470 : 430, larg = i % 2 ? 5 : 9;
    _svgAdd(s, 'rect', {
      x: _SC - larg / 2, y: _SC - long, width: larg, height: long - 150,
      fill: 'url(#sRayon)', rx: larg / 2,
      transform: `rotate(${a} ${_SC} ${_SC})`, opacity: .86
    });
  }
}

function _buildAnneau(cls, r, n, taille, p) {
  const s = _makeCouche(cls);
  _buildDefs(s, p);
  _svgAdd(s, 'circle', { cx: _SC, cy: _SC, r, fill: 'none', stroke: 'url(#sOr)', 'stroke-width': 9, opacity: .9 });
  _svgAdd(s, 'circle', { cx: _SC, cy: _SC, r: r - 3, fill: 'none', stroke: p.deep, 'stroke-width': 1, opacity: .4 });
  for (let i = 0; i < n; i++) {
    const a = (360 / n) * i * Math.PI / 180;
    const x = _SC + Math.cos(a) * r, y = _SC + Math.sin(a) * r;
    _svgAdd(s, 'circle', { cx: x, cy: y, r: taille, fill: 'url(#sOr)', stroke: p.deep, 'stroke-width': 1 });
    _svgAdd(s, 'circle', { cx: x - taille * .3, cy: y - taille * .3, r: taille * .32, fill: '#FFFFFF', opacity: .75 });
  }
}

function _buildPetales(p) {
  const s = _makeCouche('solar-petales');
  _buildDefs(s, p);
  for (let i = 0; i < 18; i++) {
    const a = (360 / 18) * i;
    _svgAdd(s, 'path', {
      d: `M ${_SC} ${_SC-150} C ${_SC+34} ${_SC-120},${_SC+30} ${_SC-60},${_SC} ${_SC-40} C ${_SC-30} ${_SC-60},${_SC-34} ${_SC-120},${_SC} ${_SC-150} Z`,
      fill: 'url(#sOr)', stroke: p.deep, 'stroke-width': 1.4,
      transform: `rotate(${a} ${_SC} ${_SC})`
    });
    _svgAdd(s, 'ellipse', {
      cx: _SC, cy: _SC - 118, rx: 7, ry: 18, fill: '#FFFFFF', opacity: .5,
      transform: `rotate(${a} ${_SC} ${_SC})`
    });
  }
}

function _buildCoeur(p) {
  const s = _makeCouche('solar-coeur');
  _buildDefs(s, p);
  for (let i = 0; i < 24; i++) {
    const a = (360 / 24) * i;
    _svgAdd(s, 'path', {
      d: `M ${_SC} ${_SC-95} Q ${_SC+18} ${_SC-55} ${_SC} ${_SC-25} Q ${_SC-18} ${_SC-55} ${_SC} ${_SC-95} Z`,
      fill: 'url(#sNoyau)', stroke: p.dark, 'stroke-width': 1,
      transform: `rotate(${a} ${_SC} ${_SC})`
    });
  }
}

function _buildNoyau(p) {
  const s = _makeCouche('solar-noyau');
  _buildDefs(s, p);
  _svgAdd(s, 'circle', { cx: _SC, cy: _SC, r: 48, fill: 'url(#sNoyau)' });
  _svgAdd(s, 'circle', { cx: _SC, cy: _SC, r: 20, fill: '#FFFFFF' });
  _svgAdd(s, 'circle', { cx: _SC, cy: _SC, r: 48, fill: 'none', stroke: p.dark, 'stroke-width': 2, opacity: .6 });
}

function _buildVolume() {
  const vol = document.createElement('div');
  vol.className = 'solar-volume';
  document.getElementById('solar-sphere').appendChild(vol);
}

// ── UI palette ────────────────────────────────────────────────────
function _buildPaletteUI() {
  const bar = document.getElementById('solar-palette-bar');
  if (!bar) return;
  bar.innerHTML = '';
  SOLAR_PALETTES.forEach((p, i) => {
    const btn = document.createElement('button');
    btn.className = 'solar-pal-btn' + (i === _solarPaletteIdx ? ' active' : '');
    btn.title = p.name;
    btn.setAttribute('aria-label', 'Palette ' + p.name);
    btn.style.background = `linear-gradient(135deg, ${p.mid}, ${p.dark})`;
    btn.onclick = () => {
      _solarPaletteIdx = i;
      try { localStorage.setItem(_SOL_PAL_KEY, i); } catch(e) {}
      rebuildSolarSphere();
    };
    bar.appendChild(btn);
  });
}

// ── API publique ──────────────────────────────────────────────────

function rebuildSolarSphere() {
  const el = document.getElementById('solar-sphere');
  if (!el) return;
  el.innerHTML = '';
  _solarDefsBuilt = false;
  const p = _sPal();
  _buildRayons(p);
  _buildAnneau('solar-anneau-ext', 360, 40, 14, p);
  _buildAnneau('solar-anneau-med', 265, 30, 11, p);
  _buildPetales(p);
  _buildCoeur(p);
  _buildNoyau(p);
  _buildVolume();
  _buildPaletteUI();
}

function setSolarBreathing(active) {
  const el = document.getElementById('solar-sphere');
  if (el) el.classList.toggle('breathing', !!active);
}

function initSolarSphere() {
  rebuildSolarSphere();
}

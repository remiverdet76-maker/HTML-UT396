/* ═══════════════════════════════════════════
   09-omcv-sphere.js — Sphère OmCv · 7 Nœuds · 21 Paires · 42 OmCv
   ───────────────────────────────────────────
   Structure 3D géométrie sacrée, FRACTALE et KALÉIDOSCOPIQUE.
   Évolue en continu sur sa propre horloge — INDÉPENDANTE du son.

   • 7 Nœuds : N × 36, de 216 (6³) à 432 (cosmique). Tout réduit à 9.
       6 nœuds placés sur un octaèdre + le nœud 11 (Centre Stable ⭐)
       au centre = cœur du Cube de Métatron.
   • 21 Paires : graphe complet K7 (chaque nœud relié à tous les autres).
   • 42 OmCv : 2 flux lumineux par arête (un dans chaque sens).
   • Fractal : 3 niveaux imbriqués qui contre-tournent.
   • Kaléidoscope : rotation 3D + cycle de teintes permanent.
   ═══════════════════════════════════════════ */
'use strict';

const OMCV_UNIT = 36;

// Les 7 Nœuds (N, valeur = N×36, factorisation, sens)
const OMCV_NODES = [
  { n: 6,  v: 216, fact: '6³',           tag: 'Cube fondamental' },
  { n: 7,  v: 252, fact: '7×36',         tag: 'Pont harmonique' },
  { n: 8,  v: 288, fact: '2×144',        tag: 'Double octave de 144' },
  { n: 9,  v: 324, fact: '18²',          tag: 'Carré de 18' },
  { n: 10, v: 360, fact: 'Sphère',       tag: 'Sphère complète' },
  { n: 11, v: 396, fact: '(360+432)/2',  tag: 'Centre Stable', center: true },
  { n: 12, v: 432, fact: '2×216',        tag: 'Cosmique' },
];

// Placement octaèdre + centre. Indices alignés sur OMCV_NODES.
// 6↔12 = octave (axe vertical), 7↔10 et 8↔9 = autres axes.
const _S = 0.92;
const OMCV_POS = [
  [0, 0,  _S],   // 6  haut
  [ _S, 0, 0],   // 7
  [0,  _S, 0],   // 8
  [0, -_S, 0],   // 9
  [-_S, 0, 0],   // 10
  [0, 0, 0],     // 11 centre
  [0, 0, -_S],   // 12 bas
];

// Les 21 Paires (graphe complet K7) + ratio réduit.
function _pgcd(a, b) { return b ? _pgcd(b, a % b) : a; }
const OMCV_EDGES = (() => {
  const e = [];
  for (let i = 0; i < 7; i++) for (let j = i + 1; j < 7; j++) {
    const a = OMCV_NODES[i].n, b = OMCV_NODES[j].n, g = _pgcd(a, b);
    e.push({ i, j, ra: a / g, rb: b / g });   // ra/rb = ratio réduit (ex. 6/12 → 1/2)
  }
  return e;
})();

// Couleur cyclique (kaléidoscope) — hsl → rgb
function _hsl(h, s, l) {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; } else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
  return `${(r + m) * 255 | 0},${(g + m) * 255 | 0},${(b + m) * 255 | 0}`;
}

// État vue (autonome)
const OV = { t: 0, rx: 0.5, ry: 0, hue: 0 };
let _omRAF = null, _omLast = 0, _omW = 0, _omH = 0, _omCx = 0, _omCy = 0, _omR = 1;

// Projection 3D → 2D avec perspective
function _omProj(p, scale, rot) {
  const crx = Math.cos(OV.rx), srx = Math.sin(OV.rx);
  const cry = Math.cos(OV.ry + rot), sry = Math.sin(OV.ry + rot);
  const x = p[0], y = p[1], z = p[2];
  const y2 = y * crx - z * srx, z2 = y * srx + z * crx;
  const x2 = x * cry + z2 * sry, z3 = -x * sry + z2 * cry;
  const fov = 2.6 / (2.6 + z3);
  const sc = _omR * scale * fov;
  return { sx: _omCx + x2 * sc, sy: _omCy + y2 * sc, fov, z: z3 };
}

// Dessine la structure (un niveau fractal)
function _omDrawLevel(ctx, scale, rot, alpha, withLabels) {
  const pv = OMCV_POS.map(p => _omProj(p, scale, rot));

  // Arêtes (21 paires) — tri arrière→avant
  const order = OMCV_EDGES.map((_, k) => k).sort((a, b) => {
    const za = (pv[OMCV_EDGES[a].i].z + pv[OMCV_EDGES[a].j].z) / 2;
    const zb = (pv[OMCV_EDGES[b].i].z + pv[OMCV_EDGES[b].j].z) / 2;
    return zb - za;
  });
  order.forEach((k, idx) => {
    const e = OMCV_EDGES[k], A = pv[e.i], B = pv[e.j];
    const hue = OV.hue + idx * 17;
    const af = (A.fov + B.fov) / 2;
    // halo
    ctx.strokeStyle = `rgba(${_hsl(hue, 80, 55)},${(alpha * 0.14 * af).toFixed(3)})`;
    ctx.lineWidth = 6 * af; ctx.beginPath(); ctx.moveTo(A.sx, A.sy); ctx.lineTo(B.sx, B.sy); ctx.stroke();
    // cœur
    ctx.strokeStyle = `rgba(${_hsl(hue, 90, 72)},${(alpha * 0.7 * af).toFixed(3)})`;
    ctx.lineWidth = 1.1 * af; ctx.beginPath(); ctx.moveTo(A.sx, A.sy); ctx.lineTo(B.sx, B.sy); ctx.stroke();

    // 42 OmCv : 2 flux lumineux par arête (sens opposés)
    for (let d = 0; d < 2; d++) {
      const t = ((OV.t * 0.18 + idx * 0.05 + d * 0.5) % 1);
      const tt = d === 0 ? t : 1 - t;
      const fx = A.sx + (B.sx - A.sx) * tt, fy = A.sy + (B.sy - A.sy) * tt;
      ctx.fillStyle = `rgba(${_hsl(hue + 180, 90, 80)},${(alpha * 0.85 * af).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(fx, fy, 2.1 * af, 0, Math.PI * 2); ctx.fill();
    }
  });

  // Nœuds (tri arrière→avant)
  const no = pv.map((_, k) => k).sort((a, b) => pv[a].z - pv[b].z);
  no.forEach(k => {
    const P = pv[k], nd = OMCV_NODES[k];
    const r = (nd.center ? 6 : 4.2) * P.fov;
    const hue = OV.hue + k * 30;
    const pulse = nd.center ? (0.7 + 0.3 * Math.sin(OV.t * 2.4)) : 1;
    ctx.shadowColor = `rgb(${_hsl(hue, 90, 70)})`; ctx.shadowBlur = 16 * P.fov * pulse;
    ctx.fillStyle = nd.center ? `rgba(255,245,210,${alpha * pulse})` : `rgba(${_hsl(hue, 85, 72)},${alpha})`;
    ctx.beginPath(); ctx.arc(P.sx, P.sy, r * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    if (withLabels && alpha > 0.6) {
      ctx.fillStyle = `rgba(240,234,216,${0.9 * P.fov})`;
      ctx.font = "11px 'IM Fell English', serif";
      ctx.fillText(nd.v, P.sx + r + 3, P.sy + 3);
    }
  });
}

function _omTick() {
  const cv = document.getElementById('omcv-canvas');
  if (!cv) { _omRAF = setTimeout(_omTick, 33); return; }
  const mob = window.innerWidth <= 900 || window.innerHeight <= 500;
  const verySmall = window.innerWidth <= 360;
  const dpr = Math.min(window.devicePixelRatio || 1, mob ? 1.5 : 2);
  const vw = window.innerWidth, vh = window.innerHeight;
  const nW = Math.round(vw * dpr), nH = Math.round(vh * dpr);
  if (cv.width !== nW || cv.height !== nH) { cv.width = nW; cv.height = nH; cv.style.width = vw + 'px'; cv.style.height = vh + 'px'; }
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  _omW = vw; _omH = vh; _omCx = vw / 2; _omCy = vh / 2;
  // Réduit le rayon sur très petit écran (≤360px) pour laisser de la place aux panneaux
  _omR = Math.min(vw, vh) * (verySmall ? 0.22 : mob ? 0.28 : 0.30);
  ctx.clearRect(0, 0, vw, vh);

  // Évolution autonome (kaléidoscope)
  OV.t  += 0.016;
  OV.ry += 0.0045;                          // rotation continue
  OV.rx  = 0.5 + 0.45 * Math.sin(OV.t * 0.12); // bascule lente
  OV.hue = (OV.hue + 0.35) % 360;           // cycle de teintes

  // Fractal : 3 niveaux imbriqués qui contre-tournent
  _omDrawLevel(ctx, 1.00,  0,            1.0,  true);
  _omDrawLevel(ctx, 0.46, -OV.t * 0.10,  0.55, false);
  _omDrawLevel(ctx, 0.20,  OV.t * 0.18,  0.32, false);

  _omRAF = setTimeout(_omTick, 33); // ~30 fps sans overhead RAF inutile
}

function initOmcv() {
  if (_omRAF) clearTimeout(_omRAF);
  _omRAF = null;
  _omTick();
}

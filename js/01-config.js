/* ═══════════════════════════════════════════
   01-config.js — Constantes, données, helpers
   ═══════════════════════════════════════════ */

const FADE   = 1.6;
const TUNE_T = 0.08;
const LS_KEY = 'fbf396_state';

const HEX_DEG    = [0, 60, 120, 180, 240, 300];
const MASTER_IDX = 6;

// 12 couleurs de la sphère (cycle à chaque trigger)
const SPHERE_COLORS_12 = [
  '#FF6B6B', '#FF9A4A', '#FFD060', '#C8FF60',
  '#56FFB0', '#60D8FF', '#7080FF', '#C080FF',
  '#FF80D0', '#FF4488', '#80FFFF', '#F0D9FF'
];
let _sphereColorIdx = 0;

const RATIO_OPTS = [
  {r:9/10,  l:'9/10'},
  {r:10/9,  l:'10/9'},
  {r:11/10, l:'11/10'},
  {r:10/11, l:'10/11'},
  {r:12/11, l:'12/11'},
  {r:11/12, l:'11/12'},
  {r:10/12, l:'10/12'},
  {r:12/10, l:'12/10'}
];

// Band A : 36–108 Hz  (oscs 0,1)
// Band B : 108–256 Hz (oscs 2,3)
// Band C : 256–432 Hz (oscs 4,5)
// Maître : variable   (osc 6)
const PAIRS = [
  { label:'Band A·1', color:'#FF6B6B', grad:['#FF6B6B','#FF9A8B'],
    pingala:{id:'p0', ri:2, n:0.3, baseFreq:63,  vol:.12}, ida:{id:'i0', delta:1.8, polarity:1, vol:.12} },
  { label:'Band A·2', color:'#FFB347', grad:['#FFB347','#FFD080'],
    pingala:{id:'p1', ri:2, n:0.6, baseFreq:81,  vol:.12}, ida:{id:'i1', delta:1.8, polarity:1, vol:.12} },
  { label:'Band B·1', color:'#E8FF60', grad:['#E8FF60','#C8FF80'],
    pingala:{id:'p2', ri:2, n:1.2, baseFreq:162, vol:.12}, ida:{id:'i2', delta:1.8, polarity:1, vol:.12} },
  { label:'Band B·2', color:'#56FFB0', grad:['#56FFB0','#80FFD0'],
    pingala:{id:'p3', ri:2, n:1.8, baseFreq:192, vol:.12}, ida:{id:'i3', delta:1.8, polarity:1, vol:.12} },
  { label:'Band C·1', color:'#60D8FF', grad:['#60D8FF','#80B0FF'],
    pingala:{id:'p4', ri:2, n:2.5, baseFreq:288, vol:.12}, ida:{id:'i4', delta:1.8, polarity:1, vol:.12} },
  { label:'Band C·2', color:'#C080FF', grad:['#C080FF','#E080FF'],
    pingala:{id:'p5', ri:2, n:2.9, baseFreq:324, vol:.12}, ida:{id:'i5', delta:1.8, polarity:1, vol:.12} },
  { label:'Maître',   color:'#FFB0FF', grad:['#FFB0FF','#FF80C0'],
    pingala:{id:'p6', ri:0, n:1.0, baseFreq:252, vol:.14}, ida:{id:'i6', delta:1.8, polarity:1, vol:.14} },
];

let mutedOscs = {};
PAIRS.forEach(p => {
  mutedOscs[p.pingala.id] = false;
  mutedOscs[p.ida.id]     = false;
});

let masterFreq  = 252;
let globalDelta = 1.8;
let masterVol   = 0.8;

function waveState(hz) {
  const a = Math.abs(hz);
  if (a < 0.5) return {s:'—',     c:'rgba(200,200,255,.4)'};
  if (a <= 4)  return {s:'Delta', c:'#C890FF'};
  if (a <= 8)  return {s:'Thêta', c:'#F5D460'};
  if (a <= 13) return {s:'Alpha', c:'#56FFB0'};
  if (a <= 30) return {s:'Bêta',  c:'#60D8FF'};
  return              {s:'Gamma', c:'#FF9A8B'};
}

// calcPFreq utilise baseFreq pour les bandes, masterFreq pour le maître
function calcPFreq(i) {
  if (i === MASTER_IDX) return masterFreq;
  return Math.max(36, Math.min(432, PAIRS[i].pingala.baseFreq));
}
function calcIFreq(i) {
  const { ida } = PAIRS[i];
  return Math.max(36, Math.min(864, calcPFreq(i) + ida.polarity * ida.delta));
}
function safeF(f)    { return Math.max(36, Math.min(864, f)); }
function fmtFreq(f)  { return f.toFixed(1) + ' Hz'; }
function fmtShort(f) { return f.toFixed(1); }

// AudioContext optimisé casques Bluetooth — grands buffers + lookahead 500 ms
try { Tone.setContext(new Tone.Context({ latencyHint: 'playback', lookAhead: 0.5 })); } catch(e) {}

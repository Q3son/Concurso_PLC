// Tablero de control: se conecta al servidor (PLC real o simulado) por WebSocket.
// Si no hay servidor (GitHub Pages o archivo local), ejecuta el gemelo digital en el navegador.
import { FactorySim } from './simulator.js';
import { History } from './history.js';
import { View2D } from './view2d.js';
import { DI, DO, AI, AO } from './iomap.js';
import {
  STATE, STATE_INFO, ALARMS, SORTER_STEP_NAME, COLOR_NAME, maskHas, unpackQueue,
} from './constants.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

let mode = 'connecting';      // 'live' | 'demo'
let snap = null;
let hist = { events: [], ppm: [] };
let ws = null;
let sim = null;
let simHistory = null;
let simSpeed = 1;
let dirty = true;
let view3d = null;
const view2d = new View2D($('#view2d'));

// ---------------------------------------------------------------------
// Conexión
// ---------------------------------------------------------------------
function startLive() {
  let opened = false;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}/ws`);
  const fallback = setTimeout(() => { if (!opened) { ws.close(); startDemo(); } }, 2500);
  ws.onopen = () => { opened = true; clearTimeout(fallback); mode = 'live'; };
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === 'snapshot') { snap = msg.data; hist = msg.history; dirty = true; }
    if (msg.type === 'hello' && msg.mode === 'sim') $('#demoPanel').hidden = false;
    if (msg.type === 'error') showNotice(msg.message, 5000);
  };
  ws.onclose = () => {
    if (!opened) return;
    snap = { source: 'plc', connected: false, error: 'Se perdió la conexión con el servidor del tablero.' };
    dirty = true;
    setTimeout(startLive, 2000);
  };
}

function startDemo() {
  mode = 'demo';
  sim = new FactorySim({ seed: Date.now() & 0xffff });
  simHistory = new History();
  $('#demoPanel').hidden = false;
  showNotice('Modo demostración: la planta y el controlador se simulan en tu navegador.');
  setInterval(() => {
    sim.step(0.05 * simSpeed);
    snap = sim.snapshot();
    simHistory.update(snap);
    hist = simHistory.toJSON();
    dirty = true;
  }, 50);
  setTimeout(() => sim.command('start'), 1200);
}

function send(name, value = true) {
  if (mode === 'demo') sim.command(name, value);
  else if (ws?.readyState === 1) ws.send(JSON.stringify({ type: 'cmd', name, value }));
}

let noticeTimer = null;
function showNotice(text, ms = 0) {
  const n = $('#notice');
  n.textContent = text;
  n.hidden = false;
  clearTimeout(noticeTimer);
  if (ms) noticeTimer = setTimeout(() => { n.hidden = true; }, ms);
}

// ---------------------------------------------------------------------
// Eventos de la interfaz
// ---------------------------------------------------------------------
document.addEventListener('click', (ev) => {
  const el = ev.target.closest('button');
  if (!el || el.disabled) return;
  if (el.dataset.cmd) send(el.dataset.cmd);
  if (el.dataset.toggle) send(el.dataset.toggle, el.getAttribute('aria-pressed') !== 'true');
  if (el.dataset.fault) {
    const on = el.getAttribute('aria-pressed') !== 'true';
    send(el.dataset.fault, on);
    el.setAttribute('aria-pressed', String(on));
  }
  if (el.dataset.speed) {
    simSpeed = Number(el.dataset.speed);
    $$('[data-speed]').forEach((b) => b.setAttribute('aria-pressed', String(b === el)));
  }
  if (el.id === 'btnEStop') send('estop', el.getAttribute('aria-pressed') !== 'true');
});

$('#lotForm').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const green = Math.max(0, Number($('#lotGreen').value) | 0);
  const blue = Math.max(0, Number($('#lotBlue').value) | 0);
  send('setLot', { green, blue });
  showNotice(green + blue ? `Lote aplicado: ${green} verdes y ${blue} azules.` : 'Producción continua.', 3000);
});

// Pestañas 2D / 3D (la vista 3D se carga solo cuando se abre)
async function selectTab(which) {
  const is3d = which === '3d';
  $('#tab2d').setAttribute('aria-selected', String(!is3d));
  $('#tab3d').setAttribute('aria-selected', String(is3d));
  $('#view2d').hidden = is3d;
  $('#view3d').hidden = !is3d;
  try { localStorage.setItem('sf-view', which); } catch { /* sin almacenamiento */ }
  if (is3d && !view3d) {
    try {
      const { View3D } = await import('./view3d.js');
      view3d = new View3D($('#view3d'));
      $('#chkLabels').addEventListener('change', (e) => view3d.showLabels(e.target.checked));
      $('#btnView').addEventListener('click', () => view3d.resetView());
    } catch (err) {
      $('#view3d').insertAdjacentHTML('beforeend', `<p class="hint pad">No se pudo cargar la vista 3D: ${err.message}</p>`);
    }
  }
  view3d?.setVisible?.(is3d);
  if (view3d && snap) view3d.update(snap);
}
$('#tab2d').addEventListener('click', () => selectTab('2d'));
$('#tab3d').addEventListener('click', () => selectTab('3d'));

// ---------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------
function buildIo() {
  const row = (d, group) => `<li><span class="dot" data-io="${group}.${d.key}"></span><b class="code">${d.code}</b>${d.label}</li>`;
  const num = (d, group) => `<li><b class="code">${d.code}</b>${d.label} <span class="num" data-num="${group}.${d.key}">0</span></li>`;
  $('#ioIn').innerHTML = DI.map((d) => row(d, 'inputs')).join('') + AI.map((d) => num(d, 'inputs')).join('');
  $('#ioOut').innerHTML = DO.map((d) => row(d, 'outputs')).join('') + AO.map((d) => num(d, 'outputs')).join('');
  $('#ioCount').textContent = `${DI.length} entradas digitales · ${DO.length} salidas digitales · ${AI.length + AO.length} registros`;
}

const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
const fmt = (n, d = 0) => (Number.isFinite(n) ? n.toFixed(d) : '—');
const pad = (n) => String(n).padStart(2, '0');
const hhmmss = (ts) => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };

function render() {
  $('#metaClock').textContent = hhmmss(Date.now());
  if (!dirty || !snap) return;
  dirty = false;

  const online = snap.connected && !snap.stale;
  const s = online ? snap.state : null;
  const info = STATE_INFO[s] ?? { short: 'Sin conexión', label: snap.error || 'El PLC no responde', tone: 'alarm' };

  $('#state').dataset.tone = info.tone;
  $('#stateShort').textContent = info.short;
  let long = snap.stale ? 'El PLC dejó de actualizar datos (¿programa detenido?)' : info.label;
  if (online && snap.lot?.completed && s === STATE.IDLE) long = 'Lote completado. Pulsa Arrancar para repetirlo.';
  $('#stateLong').textContent = long;
  $('#metaMode').textContent = online ? (snap.modeAuto ? 'Automático' : 'Manual') : '—';
  const src = $('#metaSource');
  src.textContent = mode === 'demo' ? 'Simulación local' : snap.source === 'sim' ? 'Servidor, planta simulada'
    : online ? 'PLC CODESYS, OPC UA' : 'PLC sin conexión';
  src.classList.toggle('bad', !online);

  if (!online) { disableAll(); renderBanner(null); return; }
  renderBanner(snap.alarms);

  // Mando
  const idle = s === STATE.IDLE, run = s === STATE.AUTO_RUN, stopping = s === STATE.AUTO_STOP, manual = s === STATE.MANUAL;
  const needsReset = snap.alarms.active !== 0 || snap.alarms.unack !== 0;
  $('#btnStart').disabled = !((idle && snap.modeAuto) || stopping);
  $('#btnStop').disabled = !(run || stopping);
  $('#btnReset').disabled = !needsReset;
  $('#btnReset').classList.toggle('attention', needsReset);
  const canMode = idle || manual;
  $('#segAuto').setAttribute('aria-pressed', String(!!snap.modeAuto));
  $('#segManual').setAttribute('aria-pressed', String(!snap.modeAuto));
  $('#segAuto').disabled = !canMode;
  $('#segManual').disabled = !canMode;
  $('#modeHint').textContent = canMode ? 'Cambia el modo con la máquina detenida.' : 'Detén la máquina para cambiar de modo.';
  const estopOn = !!snap.hmi?.estop;
  $('#btnEStop').setAttribute('aria-pressed', String(estopOn));
  $('#estopText').textContent = estopOn ? 'Emergencia enclavada. Pulsa para liberar' : 'Paro de emergencia';

  // Lote
  const L = snap.lot || {};
  $('#btnLot').disabled = !canMode;
  $$('#lotForm input').forEach((i) => { i.disabled = !canMode; });
  $('#lotProgress').innerHTML = L.mode
    ? `<span>Verdes <b>${L.fedGreen}</b> / ${L.green}</span><span>Azules <b>${L.fedBlue}</b> / ${L.blue}</span>${L.completed ? '<span class="pill ok">Lote completado</span>' : ''}`
    : '<span>Producción continua</span>';

  // Manual
  $$('.manual-groups [data-toggle], .manual-groups [data-cmd]').forEach((b) => { b.disabled = !manual; });
  $$('.manual-groups [data-toggle]').forEach((b) => b.setAttribute('aria-pressed', String(!!snap.hmi?.[b.dataset.toggle])));
  $('#manHint').textContent = manual ? 'Los actuadores obedecen solo a estos mandos.' : 'Disponible en modo manual.';
  $('[data-cmd="clearTracking"]').disabled = run || stopping;
  if (mode === 'demo' || snap.source === 'sim') {
    $$('[data-fault]').forEach((b) => b.setAttribute('aria-pressed', String(!!snap.faults?.[b.dataset.fault])));
  }

  view2d.update(snap);
  if (view3d && !$('#view3d').hidden) view3d.update(snap);
  renderKpi();
  renderProcess();
  renderAlarms();
  renderIo();
  drawChart();
}

function disableAll() {
  $$('button[data-cmd], button[data-toggle], #btnEStop, #btnLot').forEach((b) => { if (!b.closest('.banner')) b.disabled = true; });
}

function renderBanner(alarms) {
  const b = $('#banner');
  if (!alarms || alarms.active === 0) { b.hidden = true; return; }
  const order = { emergency: 0, fault: 1, warning: 2 };
  const top = ALARMS.filter((a) => maskHas(alarms.active, a.id)).sort((x, y) => order[x.kind] - order[y.kind])[0];
  if (!top) { b.hidden = true; return; }
  b.hidden = false;
  b.dataset.kind = top.kind;
  $('#bannerTitle').textContent = top.text;
  $('#bannerHelp').textContent = top.help;
}

function renderKpi() {
  const K = snap.kpi || {};
  $('#kPpm').textContent = fmt(K.ppm);
  $('#kTotal').textContent = fmt(K.total);
  $('#kBlueLids').textContent = fmt(K.blueLids);
  $('#kGreenLids').textContent = fmt(K.greenLids);
  $('#kBlueBases').textContent = fmt(K.blueBases);
  $('#kGreenBases').textContent = fmt(K.greenBases);
  $('#kFedGreen').textContent = fmt(K.fedGreen);
  $('#kFedBlue').textContent = fmt(K.fedBlue);
  $('#kWip').textContent = fmt(Math.max(0, (K.fedGreen ?? 0) + (K.fedBlue ?? 0) - (K.total ?? 0)));
  $('#kAvail').textContent = K.runTime + K.faultTime > 0 ? `${fmt(K.availability)} %` : '—';
  for (const [id, v] of [['MC1', K.utilMC1], ['MC2', K.utilMC2]]) {
    $(`#u${id}`).style.width = `${Math.max(0, Math.min(100, v || 0))}%`;
    $(`#u${id}`).classList.toggle('hot', (v || 0) >= 85);
    $(`#u${id}v`).textContent = Number.isFinite(v) && K.runTime > 0 ? `${fmt(v)} %` : '—';
  }
  const u1 = K.utilMC1 || 0, u2 = K.utilMC2 || 0;
  let msg = 'El cuello de botella aparece cuando una máquina pasa del 85 %.';
  if (K.runTime > 30 && Math.max(u1, u2) >= 85) {
    const id = u1 >= u2 ? 'MC1' : 'MC2';
    const cyc = id === 'MC1' ? K.cycleMC1 : K.cycleMC2;
    const cap = cyc > 0 ? (2 * 60) / cyc : 0;   // la regla de alternancia reparte 50/50 entre ramas
    msg = `${id} limita la celda${cap ? `: ciclo ${fmt(cyc, 1)} s, máximo teórico ≈ ${fmt(cap, 1)} productos/min` : ''}.`;
  }
  $('#bottleneck').textContent = msg;
}

const chipFor = (c) => `<span class="chip raw c-${c === 1 ? 'G' : c === 2 ? 'B' : 'M'}" title="${COLOR_NAME[c]}"></span>`;

function renderProcess() {
  $('#pTurn').textContent = `Turno: faja ${snap.turnBlue ? '2 (azul)' : '1 (verde)'}`;
  $('#pMain').textContent = String(snap.onMain ?? 0);
  $('#pSorter').textContent = SORTER_STEP_NAME[snap.sorterStep] ?? '—';
  $('#pSorter').classList.toggle('bad', snap.sorterStep === 90);
  $('#pNextG').textContent = snap.nextGreenToBases ? 'bases' : 'tapas';
  $('#pNextB').textContent = snap.nextBlueToBases ? 'bases' : 'tapas';
  const q = (word, n) => (n ? unpackQueue(word, n).map(chipFor).join('') + (n > 8 ? ` +${n - 8}` : '') : '<span class="muted small">vacía</span>');
  $('#pQLids').innerHTML = q(snap.lidsQueueWord, snap.lidsQueue);
  $('#pQBases').innerHTML = q(snap.basesQueueWord, snap.basesQueue);
  const I = snap.inputs || {};
  for (const [id, k, colorKey] of [['MC1', 'mc1', 'mc1Color'], ['MC2', 'mc2', 'mc2Color']]) {
    const c = snap[colorKey];
    $(`#p${id}`).textContent = I[`${k}Error`] ? 'error' : I[`${k}Opened`] ? 'puerta abierta'
      : I[`${k}Busy`] ? `mecanizando ${COLOR_NAME[c] ?? ''} ${Math.round(I[`${k}Progress`] ?? 0)} %` : 'libre';
  }
}

function renderAlarms() {
  const active = ALARMS.filter((a) => maskHas(snap.alarms.active, a.id));
  const count = $('#almCount');
  count.textContent = String(active.length);
  count.classList.toggle('has', active.length > 0);
  $('#alarmList').innerHTML = active.length
    ? active.map((a) => `<li data-kind="${a.kind}" class="${maskHas(snap.alarms.unack, a.id) ? 'unack' : ''}">
        <span class="a-text">${a.id}. ${a.text}</span><span class="a-help">${a.help}</span></li>`).join('')
    : '<li class="empty">Sin alarmas activas.</li>';
  $('#eventList').innerHTML = (hist.events || []).slice(0, 30).map((e) => {
    const a = ALARMS[e.id - 1];
    return `<li><time>${hhmmss(e.ts)}</time><span class="${e.on ? '' : 'off'}">${e.on ? '' : 'Normalizada: '}${a.text}</span></li>`;
  }).join('') || '<li class="empty">Todavía no hay eventos.</li>';
}

function renderIo() {
  $$('[data-io]').forEach((el) => el.classList.toggle('dot-on', !!get(snap, el.dataset.io)));
  $$('[data-num]').forEach((el) => { el.textContent = String(get(snap, el.dataset.num) ?? 0); });
}

function drawChart() {
  const c = $('#chart');
  const dpr = window.devicePixelRatio || 1;
  const w = c.clientWidth, h = c.clientHeight || 140;
  if (!w) return;
  if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
  const ctx = c.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const css = getComputedStyle(document.documentElement);
  const data = hist.ppm || [];
  const max = Math.max(20, ...data.map((d) => d.v * 1.2));
  const padL = 30, padB = 18, padT = 8;
  const gw = w - padL - 8, gh = h - padB - padT;
  ctx.font = `12px ${css.getPropertyValue('--font')}`;
  ctx.fillStyle = css.getPropertyValue('--steel');
  ctx.strokeStyle = css.getPropertyValue('--line');
  ctx.lineWidth = 1;
  for (const v of [0, max / 2, max]) {
    const y = padT + gh - (v / max) * gh;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - 8, y); ctx.stroke();
    ctx.fillText(String(Math.round(v)), 4, y + 4);
  }
  ctx.fillText('últimos 2 min', padL, h - 4);
  if (data.length < 2) return;
  ctx.strokeStyle = css.getPropertyValue('--ink');
  ctx.lineWidth = 2;
  ctx.beginPath();
  data.forEach((d, i) => {
    const x = padL + (i / 119) * gw;
    const y = padT + gh - (d.v / max) * gh;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

// ---------------------------------------------------------------------
buildIo();
(function loop() { render(); requestAnimationFrame(loop); })();

const params = new URLSearchParams(location.search);
const staticHost = location.hostname.endsWith('github.io') || location.protocol === 'file:';
if (staticHost || params.has('demo')) startDemo();
else startLive();

let startView = params.get('view');
if (!startView) { try { startView = localStorage.getItem('sf-view'); } catch { /* nada */ } }
if (startView === '3d') selectTab('3d');

// Acceso desde la consola del navegador para depurar
window.smartFactory = { get snapshot() { return snap; }, send, get sim() { return sim; } };

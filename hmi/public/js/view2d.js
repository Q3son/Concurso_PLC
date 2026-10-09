// =====================================================================
// Sinóptico 2D (SVG) generado desde layout.js: misma geometría que el gemelo y el plano.
// build(container) dibuja la celda una vez; update(snap) solo cambia estados y piezas.
// =====================================================================
import {
  BELTS, beltLength, beltDir, pointOn, SORTER, MACHINES, PUSHERS, SENSORS, EMITTERS, REMOVERS,
  PANEL, BOUNDS, ZONES, BELT_WIDTH,
} from './layout.js';

const SC = 46;            // px por metro
const PAD = 18;
const X = (x) => +((x - BOUNDS.minX) * SC + PAD).toFixed(1);
const Y = (y) => +((y - BOUNDS.minY) * SC + PAD).toFixed(1);
const W = Math.round((BOUNDS.maxX - BOUNDS.minX) * SC + 2 * PAD);
const H = Math.round((BOUNDS.maxY - BOUNDS.minY) * SC + 2 * PAD);
const m = (v) => +(v * SC).toFixed(1);

// Desplazamiento lateral de cada sensor respecto del eje de su faja (para que no tape las piezas)
const SENSOR_SIDE = {
  S2: [-0.6, 0.48], S4: [-0.6, -0.48], S5: [0.62, -0.5], 'S6.1': [-0.2, -0.62], 'S6.2': [0.2, -0.62], S7: [0.75, 0],
  S8: [-0.6, 0], S9: [-0.6, 0], S10: [-0.35, -0.55], S11: [-0.35, 0.55], S12: [0, 0.55], S13: [0.55, 0],
  S14: [0, -0.55], S15: [0.55, 0],
};

// Posición (fracción de la faja) de la etiqueta de cada faja
const TAG_AT = { M3: 0.3, M4: 0.62, M5: 0.62, M6: 0.75, M8: 0.75 };
// Etiquetas de sensores que se ubican a un lado para no superponerse
const LABEL_SIDE = { 'S6.1': 'end', 'S6.2': 'start' };

function beltRect(b) {
  const [x1, y1] = b.from, [x2, y2] = b.to;
  const horiz = Math.abs(y2 - y1) < 1e-6;
  const hw = BELT_WIDTH / 2;
  return horiz
    ? { x: X(Math.min(x1, x2)), y: Y(y1 - hw), w: m(Math.abs(x2 - x1)), h: m(BELT_WIDTH) }
    : { x: X(x1 - hw), y: Y(Math.min(y1, y2)), w: m(BELT_WIDTH), h: m(Math.abs(y2 - y1)) };
}

function svgCell() {
  const o = [];
  o.push(`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Sinóptico de la celda: alimentación, wheel sorter, centros de mecanizado y segregación por color">`);
  o.push('<defs><marker id="ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10z" class="arrowhead"/></marker></defs>');

  // Zonas
  for (const z of ZONES) {
    const [x1, y1, x2, y2] = z.rect;
    o.push(`<rect class="zone" x="${X(x1)}" y="${Y(y1)}" width="${m(x2 - x1)}" height="${m(y2 - y1)}" rx="6"/>`);
    const [lx, ly] = z.labelAt;
    o.push(`<text class="zone-label" x="${X(lx)}" y="${Y(ly)}" text-anchor="${z.anchor}">${z.label}</text>`);
  }

  // Fajas
  for (const [id, b] of Object.entries(BELTS)) {
    const r = beltRect(b);
    const [dx, dy] = beltDir(b);
    const L = beltLength(b);
    const a = pointOn(b, 0.25), z = pointOn(b, L - 0.25);
    const lab = pointOn(b, L * (TAG_AT[id] ?? 0.5));
    const off = Math.abs(dy) < 1e-6 ? [0, -0.52] : [0.55, 0];
    o.push(`<g class="belt" id="belt-${id}"><rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="2"/>`
      + `<line class="flow" x1="${X(a[0])}" y1="${Y(a[1])}" x2="${X(z[0])}" y2="${Y(z[1])}" marker-end="url(#ar)"/></g>`);
    o.push(`<text class="tag" x="${X(lab[0] + off[0])}" y="${Y(lab[1] + off[1]) + 4}" text-anchor="middle">${id}</text>`);
    void dx;
  }

  // Emisores y removedores
  for (const [id, e] of Object.entries(EMITTERS)) {
    const [x, y] = pointOn(BELTS[e.belt], 0);
    o.push(`<g class="device emitter" id="em-${id}"><rect x="${X(x - 0.55)}" y="${Y(y - 0.35)}" width="${m(0.5)}" height="${m(0.7)}" rx="2"/>`
      + `<text x="${X(x - 0.3)}" y="${Y(y) + 4}" text-anchor="middle">${id}</text></g>`);
  }
  for (const [id, r] of Object.entries(REMOVERS)) {
    const b = BELTS[r.belt];
    const [dx, dy] = beltDir(b);
    const [x, y] = pointOn(b, beltLength(b) + 0.25);
    const w = Math.abs(dx) > 0.5 ? 0.4 : 0.7, h = Math.abs(dy) > 0.5 ? 0.4 : 0.7;
    o.push(`<g class="device remover"><rect x="${X(x - w / 2)}" y="${Y(y - h / 2)}" width="${m(w)}" height="${m(h)}"/>`
      + `<text x="${X(x)}" y="${Y(y) + 4}" text-anchor="middle" class="tiny">${id}</text></g>`);
  }

  // Wheel sorter
  const [cx, cy] = SORTER.center, hs = SORTER.size / 2;
  o.push(`<g id="sorter" class="sorter"><rect x="${X(cx - hs)}" y="${Y(cy - hs)}" width="${m(SORTER.size)}" height="${m(SORTER.size)}" rx="3"/>`);
  for (const ix of [-0.25, 0, 0.25]) for (const iy of [-0.25, 0, 0.25]) {
    o.push(`<ellipse class="wheel" cx="${X(cx + ix)}" cy="${Y(cy + iy)}" rx="5" ry="2.4"/>`);
  }
  o.push(`<path id="ws-up" class="ws-arrow" d="M${X(cx)} ${Y(cy + 0.1)} L${X(cx)} ${Y(cy - 0.42)}" marker-end="url(#ar)"/>`);
  o.push(`<path id="ws-down" class="ws-arrow" d="M${X(cx)} ${Y(cy - 0.1)} L${X(cx)} ${Y(cy + 0.42)}" marker-end="url(#ar)"/>`);
  o.push(`<text class="tag" x="${X(cx + 0.62)}" y="${Y(cy - 0.6)}">WS1</text></g>`);
  o.push(`<text class="info" id="ws-rule" x="${X(6.05)}" y="${Y(1.3)}" text-anchor="end"></text>`);
  o.push(`<text class="info" id="ws-rule2" x="${X(6.05)}" y="${Y(1.3) + 15}" text-anchor="end"></text>`);

  // Centros de mecanizado
  for (const [id, mc] of Object.entries(MACHINES)) {
    const [x1, y1, x2, y2] = mc.rect;
    const k = id.toLowerCase();
    o.push(`<g class="machine" id="${k}"><rect class="mc-body" x="${X(x1)}" y="${Y(y1)}" width="${m(x2 - x1)}" height="${m(y2 - y1)}" rx="4"/>`
      + `<text class="mc-title" x="${X(x1) + 8}" y="${Y(y1) + 17}">${id} · ${mc.lids ? 'tapas' : 'bases'}</text>`
      + `<text class="mc-state" id="${k}-state" x="${X(x1) + 8}" y="${Y(y1) + 33}">—</text>`
      + `<rect class="mc-track" x="${X(x1) + 8}" y="${Y(y2) - 16}" width="${m(x2 - x1) - 16}" height="7" rx="2"/>`
      + `<rect class="mc-bar" id="${k}-bar" x="${X(x1) + 8}" y="${Y(y2) - 16}" width="0" height="7" rx="2"/>`
      + `<circle class="mc-led" id="${k}-led" cx="${X(x2) - 12}" cy="${Y(y1) + 13}" r="5"/></g>`);
  }

  // Pushers
  for (const [id, p] of Object.entries(PUSHERS)) {
    const [bx, by] = p.body, [dx, dy] = p.dir;
    const vertical = Math.abs(dy) > 0.5;
    const bw = vertical ? 0.7 : 0.35, bh = vertical ? 0.35 : 0.7;
    const plateW = vertical ? 0.6 : 0.12, plateH = vertical ? 0.12 : 0.6;
    const px = bx + dx * 0.24, py = by + dy * 0.24;
    o.push(`<g class="pusher" id="pu-${id}"><g class="pu-move" id="pu-${id}-move">`
      + `<line class="rod" x1="${X(bx)}" y1="${Y(by)}" x2="${X(px)}" y2="${Y(py)}"/>`
      + `<rect class="plate" x="${X(px - plateW / 2)}" y="${Y(py - plateH / 2)}" width="${m(plateW)}" height="${m(plateH)}"/></g>`
      + `<rect class="pu-body" x="${X(bx - bw / 2)}" y="${Y(by - bh / 2)}" width="${m(bw)}" height="${m(bh)}" rx="2"/>`
      + `<text class="tag" x="${X(bx + (vertical ? 0.62 : 0))}" y="${Y(by + (vertical ? 0 : 0.55)) + 4}" text-anchor="${vertical ? 'start' : 'middle'}">${id}</text>`
      + `<circle class="ls" id="ls-${id}-f" cx="${X(bx - (vertical ? 0.48 : 0))}" cy="${Y(by - (vertical ? 0 : 0.48)) - 4}" r="3.2"/>`
      + `<circle class="ls" id="ls-${id}-b" cx="${X(bx - (vertical ? 0.48 : 0))}" cy="${Y(by - (vertical ? 0 : 0.48)) + 5}" r="3.2"/></g>`);
  }

  // Sensores
  for (const s of SENSORS) {
    let x, y;
    if (s.belt === 'WS') [x, y] = SORTER.center;
    else [x, y] = pointOn(BELTS[s.belt], s.s);
    const [ox, oy] = SENSOR_SIDE[s.code] || [0, 0.55];
    x += ox; y += oy;
    const cls = `sensor ${s.type}`;
    const shape = s.type === 'vision'
      ? `<path class="${cls}" id="sen-${s.key}" d="M${X(x) - 7} ${Y(y) - 5} h14 l-4 9 h-6 z"/>`
      : `<circle class="${cls}" id="sen-${s.key}" cx="${X(x)}" cy="${Y(y)}" r="${s.type === 'capacitive' ? 6 : 5.5}"/>`;
    const side = LABEL_SIDE[s.code] ?? (ox > 0.3 ? 'start' : ox < -0.3 ? 'end' : 'middle');
    const lx = side === 'start' ? X(x) + 9 : side === 'end' ? X(x) - 9 : X(x);
    const ly = side !== 'middle' ? Y(y) + 4 : oy < 0 ? Y(y) - 9 : Y(y) + 17;
    const anchor = side;
    o.push(`<g><title>${s.code}: ${s.label}</title>${shape}<text class="sen-label" x="${lx}" y="${ly}" text-anchor="${anchor}">${s.code}</text></g>`);
  }

  // Contadores junto a cada salida
  const counters = [['M6', 'blueLids'], ['M7', 'greenLids'], ['M8', 'blueBases'], ['M9', 'greenBases']];
  for (const [belt, key] of counters) {
    const b = BELTS[belt];
    const [dx] = beltDir(b);
    const [x, y] = pointOn(b, beltLength(b));
    const tx = Math.abs(dx) > 0.5 ? x + 0.1 : x + 0.75, ty = Math.abs(dx) > 0.5 ? y + (y < 0 ? -0.75 : 1.0) : y + (y < 0 ? 0.35 : -0.15);
    o.push(`<text class="count" id="cnt-${key}" x="${X(tx)}" y="${Y(ty)}" text-anchor="${Math.abs(dx) > 0.5 ? 'end' : 'start'}">0</text>`);
  }
  // Colas de las ramas y faja principal
  o.push(`<text class="info" id="q-lids" x="${X(6.95)}" y="${Y(-1.5)}"></text>`);
  o.push(`<text class="info" id="q-bases" x="${X(6.95)}" y="${Y(1.75)}"></text>`);
  o.push(`<text class="info" id="q-main" x="${X(2.2)}" y="${Y(0.82)}"></text>`);

  // Panel y torre de luces
  const [px, py] = PANEL.at, [tx, ty] = PANEL.tower;
  o.push(`<g class="device"><rect x="${X(px - 0.9)}" y="${Y(py - 0.55)}" width="${m(1.8)}" height="${m(1.1)}" rx="3"/>`
    + `<text x="${X(px)}" y="${Y(py) - 2}" text-anchor="middle">Panel</text><text x="${X(px)}" y="${Y(py) + 12}" text-anchor="middle" class="tiny">PB1-3 · ES1 · SW1</text></g>`);
  o.push(`<g id="tower"><rect class="device-fill" x="${X(tx) - 9}" y="${Y(ty) - 32}" width="18" height="62" rx="4"/>`
    + `<circle class="lamp" data-color="red" id="lampRed" cx="${X(tx)}" cy="${Y(ty) - 20}" r="6.5"/>`
    + `<circle class="lamp" data-color="yellow" id="lampYellow" cx="${X(tx)}" cy="${Y(ty) - 1}" r="6.5"/>`
    + `<circle class="lamp" data-color="green" id="lampGreen" cx="${X(tx)}" cy="${Y(ty) + 18}" r="6.5"/>`
    + `<text class="tiny" x="${X(tx) + 14}" y="${Y(ty) + 4}">H1-H3</text></g>`);

  o.push('<g id="parts"></g>');
  o.push('</svg>');
  return o.join('');
}

// Posición de una pieza en el mundo (m)
export function partWorld(p, snap) {
  if (BELTS[p.lane]) return pointOn(BELTS[p.lane], p.s);
  if (p.lane === 'WS') {
    const [cx, cy] = SORTER.center;
    if (p.s < SORTER.pathIn) return [cx - SORTER.pathIn + p.s, cy];
    const t = p.s - SORTER.pathIn;
    const sign = p.dir === 'L' ? -1 : p.dir === 'R' ? 1 : 0;
    return sign ? [cx, cy + sign * t] : [cx + t, cy];
  }
  if (MACHINES[p.lane]) {
    const [, y1, x2, y2] = MACHINES[p.lane].rect;
    void snap;
    return [x2 - 0.38, (y1 + y2) / 2 + 0.1];
  }
  return null;
}

export class View2D {
  constructor(container) {
    this.el = container;
    this.el.innerHTML = svgCell();
    this.svg = this.el.querySelector('svg');
    this.q = (sel) => this.svg.querySelector(sel);
    this.partsG = this.q('#parts');
  }

  update(snap) {
    const I = snap.inputs || {}, O = snap.outputs || {};
    for (const id of Object.keys(BELTS)) this.q(`#belt-${id}`).classList.toggle('running', !!O[id.toLowerCase()]);
    for (const id of Object.keys(EMITTERS)) this.q(`#em-${id}`).classList.toggle('on', !!O[id.toLowerCase()]);
    for (const s of SENSORS) this.q(`#sen-${s.key}`).classList.toggle('on', !!I[s.key]);

    // Pushers: posición real en simulación; con el PLC real se deduce de los finales de carrera
    for (const id of Object.keys(PUSHERS)) {
      const k = id.toLowerCase();
      const fr = I[`${k}Front`], bk = I[`${k}Back`];
      const pos = snap.pushers?.[id] ?? (fr ? 1 : O[k] ? 0.5 : 0);
      const [dx, dy] = PUSHERS[id].dir;
      this.q(`#pu-${id}-move`).setAttribute('transform', `translate(${m(dx * pos * 0.8)} ${m(dy * pos * 0.8)})`);
      this.q(`#pu-${id}`).classList.toggle('fault', snap.pusherStep?.[k] === 90);
      this.q(`#ls-${id}-f`).classList.toggle('on', !!fr);
      this.q(`#ls-${id}-b`).classList.toggle('on', !!bk);
    }

    // Wheel sorter
    // Left = hacia M4 (arriba en el plano), Right = hacia M5 (abajo)
    this.q('#sorter').classList.toggle('on', !!O.wsPlus);
    this.q('#sorter').classList.toggle('fault', snap.sorterStep === 90);
    this.q('#ws-up').classList.toggle('on', !!(O.wsPlus && O.wsLeft));
    this.q('#ws-down').classList.toggle('on', !!(O.wsPlus && O.wsRight));
    this.q('#ws-rule').textContent = `Próximo verde → ${snap.nextGreenToBases ? 'bases' : 'tapas'}`;
    this.q('#ws-rule2').textContent = `Próximo azul → ${snap.nextBlueToBases ? 'bases' : 'tapas'}`;

    // Centros de mecanizado
    for (const [id, k, busyKey, errKey, doorKey, progKey] of [
      ['MC1', 'mc1', 'mc1Busy', 'mc1Error', 'mc1Opened', 'mc1Progress'],
      ['MC2', 'mc2', 'mc2Busy', 'mc2Error', 'mc2Opened', 'mc2Progress']]) {
      const busy = !!I[busyKey], err = !!I[errKey] || !!I[doorKey];
      const prog = Math.max(0, Math.min(100, I[progKey] ?? 0));
      const [x1, , x2] = MACHINES[id].rect;
      this.q(`#${k}-bar`).setAttribute('width', String(((m(x2 - x1) - 16) * prog) / 100));
      this.q(`#${k}`).classList.toggle('busy', busy);
      this.q(`#${k}`).classList.toggle('fault', err);
      this.q(`#${k}-led`).classList.toggle('on', !!O[`${k}Start`]);
      const st = snap.machines?.[id]?.state;
      const label = err ? (I[doorKey] ? 'Puerta abierta' : 'Error') : busy
        ? ({ loading: 'Cargando', machining: `Mecanizando ${Math.round(prog)} %`, unloading: 'Descargando' }[st] || `Ocupada ${Math.round(prog)} %`)
        : O[`${k}Start`] ? 'Esperando pieza' : 'Detenida';
      this.q(`#${k}-state`).textContent = label;
    }

    // Torre de luces
    for (const id of ['lampRed', 'lampYellow', 'lampGreen']) this.q(`#${id}`).classList.toggle('on', !!O[id]);

    // Contadores y colas
    const K = snap.kpi || {};
    for (const key of ['blueLids', 'greenLids', 'blueBases', 'greenBases']) this.q(`#cnt-${key}`).textContent = String(K[key] ?? 0);
    this.q('#q-lids').textContent = `cola ${snap.lidsQueue ?? 0}`;
    this.q('#q-bases').textContent = `cola ${snap.basesQueue ?? 0}`;
    this.q('#q-main').textContent = `en M3: ${snap.onMain ?? 0}`;

    // Piezas (solo en simulación)
    if (!snap.parts) { this.partsG.innerHTML = ''; return; }
    this.partsG.innerHTML = snap.parts.map((p) => {
      const w = partWorld(p, snap);
      if (!w) return '';
      const [x, y] = w;
      const cls = `part c-${p.color} k-${p.kind}`;
      if (p.kind === 'raw') return `<rect class="${cls}" x="${X(x) - 8}" y="${Y(y) - 8}" width="16" height="16" rx="2"/>`;
      if (p.kind === 'lid') return `<circle class="${cls}" cx="${X(x)}" cy="${Y(y)}" r="8.5"/><circle class="part-ring" cx="${X(x)}" cy="${Y(y)}" r="4"/>`;
      return `<circle class="${cls}" cx="${X(x)}" cy="${Y(y)}" r="8.5"/><rect class="part-ring" x="${X(x) - 3}" y="${Y(y) - 3}" width="6" height="6"/>`;
    }).join('');
  }
}

export const VIEW2D_SIZE = { W, H };

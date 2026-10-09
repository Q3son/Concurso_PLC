// Genera los planos de la celda a partir de la geometría y del mapa de E/S del proyecto:
//   docs/img/plano-celda.svg     Hoja 1: plano de distribución (vista superior, a escala)
//   docs/img/plano-hardware.svg  Hoja 2: arquitectura de hardware/red y asignación de E/S del PLC
// Uso: cd hmi && npm run plano      (los PNG se obtienen con npm run diagramas)
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BELTS, beltLength, beltDir, pointOn, SORTER, MACHINES, PUSHERS, SENSORS, EMITTERS, REMOVERS, PANEL,
  BOUNDS, ZONES, BELT_WIDTH,
} from '../hmi/public/js/layout.js';
import { DI, DO, AI, AO, IO_SUMMARY } from '../hmi/public/js/iomap.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'docs/img');
mkdirSync(OUT, { recursive: true });

const F = "'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const INK = '#1d2227', MUTED = '#59626b', LINE = '#9aa2a9', BELT = '#e3e6e9', ACC = '#2d5f9f', GRID = '#eef0f2';
const GREEN = '#3d8a55', BLUE = '#2f63b0', RED = '#c0322b';
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

class Svg {
  constructor(w, h) { this.w = w; this.h = h; this.o = []; }
  add(s) { this.o.push(s); }
  text(x, y, t, { size = 13, anchor = 'start', weight = 400, fill = INK, italic = false } = {}) {
    this.add(`<text x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor}" font-weight="${weight}" fill="${fill}"${italic ? ' font-style="italic"' : ''}>${esc(t)}</text>`);
  }
  rect(x, y, w, h, { fill = 'none', stroke = INK, sw = 1.4, dash = null, rx = 0 } = {}) {
    this.add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`);
  }
  line(x1, y1, x2, y2, { stroke = INK, sw = 1.4, dash = null, marker = null } = {}) {
    this.add(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ''}${marker ? ` marker-end="url(#${marker})"` : ''}/>`);
  }
  toString() {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.w} ${this.h}" width="${this.w}" height="${this.h}" font-family="${F}">`
      + '<defs>'
      + `<marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="${ACC}"/></marker>`
      + `<marker id="arrk" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="${INK}"/></marker>`
      + `<marker id="tick" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M5 0 L5 10" stroke="${INK}" stroke-width="1.6"/></marker>`
      + '</defs>'
      + `<rect width="${this.w}" height="${this.h}" fill="#fff"/>${this.o.join('')}</svg>`;
  }
}

function titleBlock(s, x, y, w, sheet, title, scale = '1 cuadro = 1 m') {
  const rows = [
    ['Smart Factory Challenge · HRFEST 2026', 17, 700],
    [title, 14, 400],
  ];
  s.rect(x, y, w, 150, { sw: 1.8 });
  let yy = y;
  rows.forEach(([t, size, wt]) => { s.text(x + 14, yy + 28, t, { size, weight: wt }); yy += 40; s.line(x, yy, x + w, yy, { sw: 1 }); });
  s.line(x + w / 2, yy, x + w / 2, y + 150, { sw: 1 });
  s.text(x + 14, yy + 24, `Escala: ${scale}`, { size: 13 });
  s.text(x + w / 2 + 14, yy + 24, `Hoja: ${sheet} de 2`, { size: 13 });
  s.line(x, yy + 35, x + w, yy + 35, { sw: 1 });
  s.text(x + 14, yy + 58, 'Fecha: 2026-10', { size: 13 });
  s.text(x + w / 2 + 14, yy + 58, 'Rev.: C (observaciones)', { size: 13 });
}

// =====================================================================
// HOJA 1: PLANO DE DISTRIBUCIÓN
// =====================================================================
function sheet1() {
  const W = 1700, H = 1130;
  const s = new Svg(W, H);
  const SC = 54, OX = 46, OY = 104;
  const X = (x) => +(OX + (x - BOUNDS.minX) * SC).toFixed(1);
  const Y = (y) => +(OY + (y - BOUNDS.minY) * SC).toFixed(1);
  const m = (v) => +(v * SC).toFixed(1);
  const DW = m(BOUNDS.maxX - BOUNDS.minX), DH = m(BOUNDS.maxY - BOUNDS.minY);

  s.rect(14, 14, W - 28, H - 28, { sw: 2 });
  s.text(40, 52, 'Plano de distribución: celda de tapas y bases con segregación por color', { size: 21, weight: 700 });
  s.text(40, 76, 'Vista superior a escala. Un solo PLC controla toda la celda. Flechas azules: sentido de avance de las piezas.', { size: 13, fill: MUTED });

  // Cuadrícula de 1 m
  for (let x = Math.ceil(BOUNDS.minX); x <= BOUNDS.maxX; x++) s.line(X(x), OY, X(x), OY + DH, { stroke: GRID, sw: 1 });
  for (let y = Math.ceil(BOUNDS.minY); y <= BOUNDS.maxY; y++) s.line(OX, Y(y), OX + DW, Y(y), { stroke: GRID, sw: 1 });
  s.rect(OX, OY, DW, DH, { stroke: LINE, sw: 1 });

  // Zonas
  for (const z of ZONES) {
    const [x1, y1, x2, y2] = z.rect;
    s.rect(X(x1), Y(y1), m(x2 - x1), m(y2 - y1), { stroke: MUTED, sw: 1.2, dash: '7 5', rx: 6 });
    s.text(X(z.labelAt[0]), Y(z.labelAt[1]), z.label, { size: 12, weight: 700, fill: MUTED, anchor: z.anchor });
  }

  const tag = (x, y, code, w = 34) => {
    s.rect(x - w / 2, y - 11, w, 20, { fill: '#fff', sw: 1.2, rx: 3 });
    s.text(x, y + 4, code, { size: 11, anchor: 'middle', weight: 700 });
  };

  // Fajas con chevrons en el sentido de avance
  const TAG_AT = { M3: 0.3, M4: 0.62, M5: 0.62, M6: 0.75, M8: 0.75 };
  for (const [id, b] of Object.entries(BELTS)) {
    const [dx, dy] = beltDir(b), L = beltLength(b), hw = BELT_WIDTH / 2;
    const horiz = Math.abs(dy) < 1e-6;
    const [x1, y1] = b.from, [x2, y2] = b.to;
    if (horiz) s.rect(X(Math.min(x1, x2)), Y(y1 - hw), m(Math.abs(x2 - x1)), m(BELT_WIDTH), { fill: BELT, sw: 1.3 });
    else s.rect(X(x1 - hw), Y(Math.min(y1, y2)), m(BELT_WIDTH), m(Math.abs(y2 - y1)), { fill: BELT, sw: 1.3 });
    for (let d = 0.45; d < L - 0.2; d += 0.75) {
      const [cx, cy] = pointOn(b, d);
      const px = X(cx), py = Y(cy), k = 6;
      const ax = dx * k, ay = dy * k, nx = -dy * k, ny = dx * k;
      s.add(`<path d="M${px - ax + nx} ${py - ay + ny} L${px} ${py} L${px - ax - nx} ${py - ay - ny}" fill="none" stroke="${ACC}" stroke-width="1.5"/>`);
    }
    const [lx, ly] = pointOn(b, L * (TAG_AT[id] ?? 0.5));
    if (horiz) tag(X(lx), Y(ly - 0.62), id); else tag(X(lx + 0.62), Y(ly), id);
  }

  // Emisores y removedores
  for (const [id, e] of Object.entries(EMITTERS)) {
    const [x, y] = pointOn(BELTS[e.belt], 0);
    s.rect(X(x - 0.6), Y(y - 0.38), m(0.6), m(0.76), { fill: '#fff', sw: 1.4 });
    s.text(X(x - 0.3), Y(y) + 5, id, { size: 13, anchor: 'middle', weight: 700 });
    s.text(X(x - 0.6), Y(y + (y < 0 ? -0.55 : 0.75)), e.color === 'G' ? 'crudo verde' : 'crudo azul', { size: 11, fill: e.color === 'G' ? GREEN : BLUE, weight: 600 });
  }
  for (const [id, r] of Object.entries(REMOVERS)) {
    const b = BELTS[r.belt];
    const [dx] = beltDir(b);
    const [x, y] = pointOn(b, beltLength(b) + 0.25);
    const w = Math.abs(dx) > 0.5 ? 0.45 : 0.75, h = Math.abs(dx) > 0.5 ? 0.75 : 0.45;
    s.rect(X(x - w / 2), Y(y - h / 2), m(w), m(h), { fill: '#fff', sw: 1.4 });
    s.text(X(x), Y(y) + 4, id, { size: 11, anchor: 'middle', weight: 700 });
  }
  const exitLabels = { M6: 'tapas azules', M7: 'tapas verdes', M8: 'bases azules', M9: 'bases verdes' };
  for (const [id, t] of Object.entries(exitLabels)) {
    const b = BELTS[id];
    const [dx] = beltDir(b);
    const [x, y] = pointOn(b, beltLength(b) + 0.25);
    const col = t.includes('verde') ? GREEN : BLUE;
    if (Math.abs(dx) > 0.5) s.text(X(x + 0.35), Y(y + (y < 0 ? -0.62 : 0.85)), t, { size: 12, anchor: 'end', weight: 700, fill: col });
    else s.text(X(x + 0.62), Y(y + (y < 0 ? 0.25 : -0.05)), t, { size: 12, weight: 700, fill: col });
  }

  // Wheel sorter
  const [cx, cy] = SORTER.center, hs = SORTER.size / 2;
  s.rect(X(cx - hs), Y(cy - hs), m(SORTER.size), m(SORTER.size), { fill: '#fff', sw: 1.8 });
  for (const ix of [-0.27, 0, 0.27]) for (const iy of [-0.27, 0, 0.27]) s.add(`<ellipse cx="${X(cx + ix)}" cy="${Y(cy + iy)}" rx="6" ry="3" fill="none" stroke="${INK}" stroke-width="1"/>`);
  s.line(X(cx), Y(cy - 0.05), X(cx), Y(cy - 0.62), { stroke: ACC, sw: 2, marker: 'arr' });
  s.line(X(cx), Y(cy + 0.05), X(cx), Y(cy + 0.62), { stroke: ACC, sw: 2, marker: 'arr' });
  tag(X(cx + 0.95), Y(cy - 0.62), 'WS1', 40);

  // Centros de mecanizado
  for (const [id, mc] of Object.entries(MACHINES)) {
    const [x1, y1, x2, y2] = mc.rect;
    s.rect(X(x1), Y(y1), m(x2 - x1), m(y2 - y1), { fill: '#f6f7f8', sw: 1.8, rx: 4 });
    s.text(X(x1) + 10, Y(y1) + 20, `${id} · ${mc.lids ? 'tapas' : 'bases'}`, { size: 13.5, weight: 700 });
    s.text(X(x1) + 10, Y(y1) + 37, `Machining Center · ${mc.lids ? '6 s' : '3 s'}`, { size: 11.5, fill: MUTED });
    const rx = (x1 + x2) / 2 - 0.2, ry = (y1 + y2) / 2 + 0.15;
    s.add(`<circle cx="${X(rx)}" cy="${Y(ry)}" r="11" fill="#fff" stroke="${INK}" stroke-width="1.3"/>`);
    s.text(X(rx) + 16, Y(ry) + 4, 'robot', { size: 10.5, fill: MUTED });
    const entry = pointOn(BELTS[mc.entryBelt], beltLength(BELTS[mc.entryBelt]));
    s.text(X(entry[0] - 0.42), Y(entry[1] + (y1 < 0 ? -0.28 : 0.45)), 'entrada', { size: 10.5, anchor: 'end', fill: MUTED });
    const exitP = pointOn(BELTS[mc.exitBelt], 0);
    s.text(X(exitP[0] + 0.05), Y(exitP[1] + (y1 < 0 ? 0.62 : -0.48)), 'salida', { size: 10.5, fill: MUTED });
  }

  // Pushers
  for (const [id, p] of Object.entries(PUSHERS)) {
    const [bx, by] = p.body, [dx, dy] = p.dir;
    s.rect(X(bx - 0.36), Y(by - 0.19), m(0.72), m(0.38), { fill: '#fff', sw: 1.5 });
    s.text(X(bx), Y(by) + 4, id, { size: 11.5, anchor: 'middle', weight: 700 });
    s.line(X(bx + dx * 0.2), Y(by + dy * 0.2), X(bx + dx * 0.62), Y(by + dy * 0.62), { stroke: ACC, sw: 2, marker: 'arr' });
    s.text(X(bx + 0.48), Y(by) + 4, `${p.limits[0]}/${p.limits[1]}`, { size: 10.5, fill: MUTED });
  }

  // Sensores
  const SIDE = {
    S2: [-0.6, 0.48], S4: [-0.6, -0.48], S5: [0.62, -0.5], 'S6.1': [-0.2, -0.62], 'S6.2': [0.2, -0.62], S7: [0.8, 0.2],
    S8: [-0.6, 0], S9: [-0.6, 0], S10: [-0.35, -0.55], S11: [-0.35, 0.55], S12: [0, 0.55], S13: [0.55, 0],
    S14: [0, -0.55], S15: [0.55, 0],
  };
  const LBL = { 'S6.1': 'end', 'S6.2': 'start', S2: 'end', S4: 'end', S8: 'end', S9: 'end', S10: 'end', S11: 'end', S5: 'start', S7: 'start', S13: 'start', S15: 'start' };
  for (const sen of SENSORS) {
    let [x, y] = sen.belt === 'WS' ? SORTER.center : pointOn(BELTS[sen.belt], sen.s);
    const [ox, oy] = SIDE[sen.code] || [0, 0.55];
    x += ox; y += oy;
    const px = X(x), py = Y(y);
    if (sen.type === 'vision') {
      s.add(`<path d="M${px - 8} ${py - 6} h16 l-5 11 h-6 z" fill="#fff" stroke="${ACC}" stroke-width="1.6"/>`);
    } else if (sen.type === 'capacitive') {
      s.add(`<circle cx="${px}" cy="${py}" r="7.5" fill="#fff" stroke="${INK}" stroke-width="1.6"/><circle cx="${px}" cy="${py}" r="3.6" fill="none" stroke="${INK}" stroke-width="1.2"/>`);
    } else {
      s.add(`<circle cx="${px}" cy="${py}" r="7.5" fill="#fff" stroke="${INK}" stroke-width="1.6"/><line x1="${px - 4.5}" y1="${py}" x2="${px + 4.5}" y2="${py}" stroke="${INK}" stroke-width="1.3"/>`);
    }
    const side = LBL[sen.code] || 'middle';
    const lx = side === 'start' ? px + 11 : side === 'end' ? px - 11 : px;
    const ly = side === 'middle' ? (oy < 0 ? py - 11 : py + 21) : py + 4;
    s.text(lx, ly, sen.code, { size: 12, anchor: side, weight: 700 });
  }

  // Cotas
  const dim = (x1, y1, x2, y2, t, off = -8) => {
    s.line(X(x1), Y(y1), X(x2), Y(y2), { sw: 1, marker: 'arrk' });
    s.line(X(x2), Y(y2), X(x1), Y(y1), { sw: 1, marker: 'arrk' });
    s.text((X(x1) + X(x2)) / 2, (Y(y1) + Y(y2)) / 2 + off, t, { size: 11.5, anchor: 'middle', fill: INK });
  };
  dim(-3.6, -2.85, 0.7, -2.85, `M1 y M2 · ${beltLength(BELTS.M1).toFixed(1).replace('.', ',')} m`);
  dim(0.9, 0.62, 6.0, 0.62, 'M3 · 6,0 m', 16);

  // Panel y torre
  const [px, py] = PANEL.at, [tx, ty] = PANEL.tower;
  s.rect(X(px - 0.95), Y(py - 0.6), m(1.9), m(1.2), { fill: '#fff', sw: 1.4, rx: 3 });
  s.text(X(px), Y(py) - 4, 'Panel', { size: 12.5, anchor: 'middle', weight: 700 });
  s.text(X(px), Y(py) + 13, 'PB1-3 · ES1 · SW1', { size: 10.5, anchor: 'middle', fill: MUTED });
  s.rect(X(tx) - 11, Y(ty) - 36, 22, 72, { fill: '#fff', sw: 1.4, rx: 4 });
  [['#d0312d', -22], ['#e2a70f', 0], ['#2ea05a', 22]].forEach(([c, d]) => s.add(`<circle cx="${X(tx)}" cy="${Y(ty) + d}" r="7.5" fill="${c}" stroke="${INK}"/>`));
  s.text(X(tx) + 18, Y(ty) + 4, 'H1-H3', { size: 11.5, weight: 700 });

  // Barra de escala
  const sbX = OX + 20, sbY = OY + DH - 22;
  for (let i = 0; i < 5; i++) s.rect(sbX + i * SC, sbY, SC, 8, { fill: i % 2 ? '#fff' : INK, sw: 1 });
  s.text(sbX, sbY - 6, '0', { size: 11 }); s.text(sbX + 5 * SC, sbY - 6, '5 m', { size: 11, anchor: 'middle' });

  // ---------- Columna derecha ----------
  const RX = OX + DW + 24, RW = W - 40 - RX;
  const list = [
    ['E1, E2', 'Emisores: crudo verde / crudo azul'],
    ['M1, M2', 'Fajas alimentadoras 1 (verde) y 2 (azul)'],
    ['S2, S4', 'Pieza lista para empujar (difuso)'],
    ['Y01, Y02', 'Pushers faja 1/2 → faja principal'],
    ['S5', 'Pieza caída en la faja principal'],
    ['M3', 'Faja alimentadora principal'],
    ['S6.1, S6.2', 'Visión digital: crudo verde / azul'],
    ['WS1', 'Wheel sorter: Left = tapas, Right = bases'],
    ['S7', 'Presencia en el wheel sorter'],
    ['M4, M5', 'Ramas de tapas / bases'],
    ['S8, S9', 'Pieza en la entrada de MC1 / MC2'],
    ['MC1, MC2', 'Centros de mecanizado: tapas / bases'],
    ['M6, M8', 'Salidas tapas / bases (azules siguen)'],
    ['S10, S11', 'Visión: tapa verde / base verde'],
    ['Y03, Y04', 'Pushers de producto verde'],
    ['M7, M9', 'Salidas tapas / bases verdes'],
    ['S12 a S15', 'Contadores capacitivos de salida'],
    ['LS1 a LS8', 'Finales de carrera de los pushers'],
    ['R1 a R4', 'Removedores al final de las salidas'],
    ['H1 a H3', 'Torre de luces verde, amarilla, roja'],
    ['PB1-3, ES1', 'Start, Stop (NC), Reset, emergencia (NC)'],
    ['SW1, D1', 'Selector Auto/Manual, display'],
  ];
  const rowH = 22, top = 40;
  const listH = 44 + list.length * rowH;
  s.rect(RX, top, RW, listH, { sw: 1.8 });
  s.text(RX + 14, top + 28, 'Lista de dispositivos', { size: 16, weight: 700 });
  list.forEach(([c, t], i) => {
    const yy = top + 44 + i * rowH;
    s.line(RX, yy, RX + RW, yy, { stroke: '#c9ced3', sw: 1 });
    s.text(RX + 14, yy + 15.5, c, { size: 12, weight: 700 });
    s.text(RX + 108, yy + 15.5, t, { size: 12 });
  });

  let y2 = top + listH + 16;
  const sum = [
    `Entradas digitales: ${IO_SUMMARY.di} (${IO_SUMMARY.processSensors} de proceso)`,
    `Registros de entrada: ${IO_SUMMARY.ai} (avance de MC1 y MC2)`,
    `Salidas digitales: ${IO_SUMMARY.do} (${IO_SUMMARY.processActuators} de proceso)`,
    `Registro de salida: ${IO_SUMMARY.ao} (display)`,
    'Bases del reto: mínimo 6 sensores y 4 actuadores',
  ];
  s.rect(RX, y2, RW, 34 + sum.length * 19, { sw: 1.4 });
  s.text(RX + 14, y2 + 24, 'Resumen de señales (un solo PLC)', { size: 14, weight: 700 });
  sum.forEach((t, i) => s.text(RX + 14, y2 + 46 + i * 19, t, { size: 12, fill: i === sum.length - 1 ? MUTED : INK }));
  y2 += 34 + sum.length * 19 + 14;

  const obs = [
    'S1 y S3 eliminados (no necesarios)',
    'S2 / S4: pieza lista para empujar con Y01 / Y02',
    'S5 confirma la caída en la faja principal',
    'S6.1 / S6.2: visión digital crudo verde / azul',
    'WS1 alterna tapas/bases por cada color',
    'Salida azul de largo; Y03 / Y04 desvían el verde',
    'S12 a S15 cuentan cada producto terminado',
  ];
  s.rect(RX, y2, RW, 34 + obs.length * 18.5, { sw: 1.4, stroke: ACC });
  s.text(RX + 14, y2 + 24, 'Observaciones del jurado aplicadas (Rev. C)', { size: 13.5, weight: 700, fill: ACC });
  obs.forEach((t, i) => s.text(RX + 14, y2 + 45 + i * 18.5, `· ${t}`, { size: 12 }));

  titleBlock(s, RX, H - 40 - 150, RW, 1, 'Plano de distribución de la celda');

  // Leyenda inferior
  const ly = OY + DH + 30;
  let lx = OX;
  const leg = (draw, t) => { draw(lx, ly); s.text(lx + 20, ly + 4, t, { size: 12 }); lx += 30 + t.length * 6.6; };
  leg((x, y) => s.add(`<circle cx="${x + 6}" cy="${y}" r="7" fill="#fff" stroke="${INK}" stroke-width="1.5"/><line x1="${x + 2}" y1="${y}" x2="${x + 10}" y2="${y}" stroke="${INK}"/>`), 'Sensor difuso');
  leg((x, y) => s.add(`<path d="M${x - 1} ${y - 6} h15 l-5 11 h-5 z" fill="#fff" stroke="${ACC}" stroke-width="1.5"/>`), 'Sensor de visión (digital)');
  leg((x, y) => s.add(`<circle cx="${x + 6}" cy="${y}" r="7" fill="#fff" stroke="${INK}" stroke-width="1.5"/><circle cx="${x + 6}" cy="${y}" r="3.4" fill="none" stroke="${INK}"/>`), 'Sensor capacitivo (conteo)');
  leg((x, y) => s.add(`<path d="M${x} ${y - 6} L${x + 8} ${y} L${x} ${y + 6}" fill="none" stroke="${ACC}" stroke-width="1.6"/>`), 'Sentido de avance');
  leg((x, y) => s.rect(x - 2, y - 7, 16, 14, { fill: BELT, sw: 1.2 }), 'Faja transportadora (Belt Conveyor)');
  s.text(OX, ly + 30, 'Comunicación: todos los sensores y actuadores de Factory I/O llegan al mismo PLC (CODESYS Control Win V3) por Modbus TCP. Ver hoja 2.', { size: 12, fill: MUTED });

  return s.toString();
}

// =====================================================================
// HOJA 2: ARQUITECTURA DE HARDWARE Y ASIGNACIÓN DE E/S
// =====================================================================
function sheet2() {
  const W = 1700, H = 1130;
  const s = new Svg(W, H);
  s.rect(14, 14, W - 28, H - 28, { sw: 2 });
  s.text(40, 52, 'Plano de hardware: arquitectura de control, red y asignación de E/S del PLC', { size: 21, weight: 700 });
  s.text(40, 76, 'Todo corre en la laptop del equipo (requisito de la final presencial). La botonera Arduino es opcional.', { size: 13, fill: MUTED });

  // Bloques
  const block = (x, y, w, h, title, lines, { stroke = INK, fill = '#fff', bold = false } = {}) => {
    s.rect(x, y, w, h, { fill, stroke, sw: bold ? 2.2 : 1.6, rx: 6 });
    s.text(x + w / 2, y + 26, title, { size: 15, weight: 700, anchor: 'middle', fill: bold ? ACC : INK });
    lines.forEach((t, i) => s.text(x + w / 2, y + 48 + i * 18, t, { size: 12, anchor: 'middle', fill: MUTED }));
  };
  s.rect(40, 100, 1620, 330, { stroke: MUTED, sw: 1.2, dash: '8 5', rx: 8 });
  s.text(56, 122, 'Laptop del equipo (Windows 10/11)', { size: 13, weight: 700, fill: MUTED });

  block(70, 150, 300, 150, 'Factory I/O', ['Planta virtual (escena propia)', 'Driver: Modbus TCP/IP Client', 'Host 127.0.0.1 · puerto 502', `${IO_SUMMARY.di} entradas · ${IO_SUMMARY.do} salidas · 3 reg.`]);
  block(520, 150, 330, 150, 'CODESYS Control Win V3 x64', ['PLC virtual único · MainTask 10 ms', 'Modbus TCP Slave Device (502)', 'Servidor OPC UA (4840)', 'IEC 61131-3 Structured Text'], { stroke: ACC, bold: true });
  block(1000, 150, 290, 150, 'Servidor HMI (Node.js)', ['server.js · cliente node-opcua', 'WebSocket /ws · puerto 3000', 'Historial de alarmas y KPI', 'npm start  /  npm run demo']);
  block(1380, 150, 250, 150, 'Navegador', ['Tablero HMI en tiempo real', 'Sinóptico 2D + gemelo 3D', 'http://localhost:3000']);
  block(1000, 330, 290, 80, 'Botonera Arduino (opcional)', ['Start, Stop, Reset, emergencia, LEDs', 'USB serie 115200 · watchdog']);
  block(520, 330, 330, 80, 'WebVisu de CODESYS (opcional)', ['HMI nativo: http://localhost:8080']);

  const link = (x1, y1, x2, y2, t, t2) => {
    s.line(x1, y1, x2, y2, { stroke: ACC, sw: 2.2, marker: 'arr' });
    s.line(x2, y2, x1, y1, { stroke: ACC, sw: 2.2, marker: 'arr' });
    s.text((x1 + x2) / 2, y1 - 10, t, { size: 12.5, anchor: 'middle', weight: 700, fill: ACC });
    if (t2) s.text((x1 + x2) / 2, y1 + 20, t2, { size: 11.5, anchor: 'middle', fill: MUTED });
  };
  link(372, 225, 518, 225, 'Modbus TCP', 'puerto 502');
  link(852, 225, 998, 225, 'OPC UA', 'puerto 4840');
  link(1292, 225, 1378, 225, 'WebSocket', '');
  s.line(1145, 330, 1145, 302, { stroke: ACC, sw: 1.8, dash: '6 4', marker: 'arr' });
  s.line(685, 330, 685, 302, { stroke: ACC, sw: 1.8, dash: '6 4', marker: 'arr' });

  // Asignación de E/S (como tarjetas de un PLC)
  const cardTop = 460;
  s.text(40, cardTop, 'Asignación de E/S del PLC (GVL_IO ↔ Modbus TCP ↔ Factory I/O)', { size: 17, weight: 700 });
  const card = (x, y, w, title, rows, color) => {
    const rh = 19.5;
    s.rect(x, y, w, 34 + rows.length * rh, { sw: 1.6, rx: 4 });
    s.rect(x, y, w, 30, { fill: color, stroke: color, sw: 1, rx: 4 });
    s.text(x + 10, y + 20, title, { size: 13, weight: 700, fill: '#fff' });
    rows.forEach((r, i) => {
      const yy = y + 30 + i * rh;
      if (i % 2) s.rect(x + 1, yy, w - 2, rh, { fill: '#f4f5f6', stroke: 'none', sw: 0 });
      s.text(x + 10, yy + 14, String(r.addr).padStart(2, '0'), { size: 11.5, fill: MUTED });
      s.text(x + 40, yy + 14, r.code, { size: 11.5, weight: 700 });
      s.text(x + 92, yy + 14, r.plc, { size: 11.5 });
    });
    return 34 + rows.length * rh;
  };
  const cw = 395, gap = 10, y0 = cardTop + 16;
  card(40, y0, cw, 'DI · Coils 0-16 (sensores)', DI.slice(0, 17), INK);
  card(40 + cw + gap, y0, cw, 'DI · Coils 17-33 (sensores)', DI.slice(17), INK);
  card(40 + 2 * (cw + gap), y0, cw, 'DO · Discrete Inputs 0-15 (actuadores)', DO.slice(0, 16), ACC);
  card(40 + 3 * (cw + gap), y0, cw, 'DO · Discrete Inputs 16-31 (actuadores)', DO.slice(16), ACC);
  const yAI = y0 + 34 + 17 * 19.5 + 14;
  const hAI = card(40, yAI, cw, 'AI · Holding Registers 0-1', AI, '#59626b');
  card(40 + cw + gap, yAI, cw, 'AO · Input Register 0', AO, '#59626b');
  void hAI;
  const yN = yAI + 100;
  s.text(40, yN, 'Notas', { size: 13, weight: 700 });
  [
    'Factory I/O escribe los sensores en Coils y lee los actuadores en Discrete Inputs (driver Modbus TCP/IP Client).',
    'Paro (PB2) y emergencia (ES1) son contactos NC: cable cortado o planta detenida = emergencia (fail-safe).',
    'S6.1, S6.2, S10 y S11 son Vision Sensor en configuración digital de un solo tipo de pieza.',
    'El mapa completo y el orden exacto están en docs/02-mapa-io.md y hmi/public/js/iomap.js (verificado por npm test).',
  ].forEach((t, i) => s.text(40, yN + 22 + i * 19, `· ${t}`, { size: 12 }));

  titleBlock(s, W - 40 - 520, H - 40 - 150, 520, 2, 'Arquitectura de hardware y asignación de E/S', 'sin escala');
  return s.toString();
}

writeFileSync(path.join(OUT, 'plano-celda.svg'), sheet1());
writeFileSync(path.join(OUT, 'plano-hardware.svg'), sheet2());
console.log('Planos generados en docs/img: plano-celda.svg, plano-hardware.svg');

// =====================================================================
// Plant: modelo físico simplificado de la escena de Factory I/O.
// Recibe las salidas del PLC (actuadores), mueve las piezas y devuelve las entradas (sensores).
// No contiene lógica de control: eso está en control.js (espejo del PLC).
// =====================================================================
import {
  BELTS, beltLength, BELT_SPEED, SORTER, SORTER_SPEED, PART_GAP, PUSHERS, PUSHER_REACH, PUSHER_STROKE_S,
  SENSORS, SENSOR_TOL, EMITTERS, REMOVERS, MACHINES,
} from './layout.js';

const LEN = Object.fromEntries(Object.entries(BELTS).map(([id, b]) => [id, beltLength(b)]));
const SORTER_LEN = SORTER.pathIn + SORTER.pathOut;
// Tiempos del Machining Center (docs de Factory I/O: tapas 6 s, bases 3 s)
export const MC_TIMES = Object.freeze({ load: 1.2, lid: 6.0, base: 3.0, unload: 1.2 });

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const FAULTS = Object.freeze([
  'y01Stuck', 'y02Stuck', 'y03Stuck', 'y04Stuck', 'mc1Error', 'mc2Error', 'mc1Door', 'mc2Door',
  'jamBlueLids', 'jamGreenLids', 'jamBlueBases', 'jamGreenBases', 'unknownPart',
]);
const JAM_OF = { M6: 'jamBlueLids', M7: 'jamGreenLids', M8: 'jamBlueBases', M9: 'jamGreenBases' };
const EXIT_EXPECT = {
  blueLids: { color: 'B', kind: 'lid' }, greenLids: { color: 'G', kind: 'lid' },
  blueBases: { color: 'B', kind: 'base' }, greenBases: { color: 'G', kind: 'base' },
};

export class Plant {
  constructor({ seed = 2026, emitMin = 1.0, emitMax = 2.0 } = {}) {
    this.rand = mulberry32(seed);
    this.emitMin = emitMin; this.emitMax = emitMax;
    this.t = 0;
    this.parts = [];
    this.nextId = 1;
    this.emitTimer = { E1: 0, E2: 0.5 };
    this.pusherPos = { Y01: 0, Y02: 0, Y03: 0, Y04: 0 };
    this.sorterDir = 'S';
    this.mc = {
      MC1: { state: 'idle', timer: 0, part: null, progress: 0, started: false, error: false },
      MC2: { state: 'idle', timer: 0, part: null, progress: 0, started: false, error: false },
    };
    this.faults = Object.fromEntries(FAULTS.map((f) => [f, false]));
    this.panel = { start: false, stop: true, reset: false, estop: true, selAuto: true };
    this.delivered = { blueLids: 0, greenLids: 0, blueBases: 0, greenBases: 0 };
    this.byOrigin = { G: { lid: 0, base: 0 }, B: { lid: 0, base: 0 } };   // producto final por color de crudo
    this.sortingErrors = 0;
    this.collisions = 0;
    this.lost = 0;
    this.emitted = { E1: 0, E2: 0 };
    this.inputs = this.sense();
  }

  // ---------------- Sensores ----------------
  partsOn(lane) { return this.parts.filter((p) => p.lane === lane); }
  near(lane, s, tol = SENSOR_TOL) { return this.parts.find((p) => p.lane === lane && Math.abs(p.s - s) < tol); }

  sense() {
    const v = {};
    for (const sen of SENSORS) {
      if (sen.belt === 'WS') { v[sen.key] = this.parts.some((p) => p.lane === 'WS'); continue; }
      const p = this.near(sen.belt, sen.s);
      if (sen.type === 'vision') v[sen.key] = !!p && p.color === sen.detects.color && p.kind === sen.detects.kind;
      else v[sen.key] = !!p;
    }
    const P = this.pusherPos;
    const mc = (id) => {
      const m = this.mc[id];
      return {
        busy: m.state !== 'idle', error: m.error || this.faults[id === 'MC1' ? 'mc1Error' : 'mc2Error'],
        opened: this.faults[id === 'MC1' ? 'mc1Door' : 'mc2Door'], progress: Math.round(m.progress),
      };
    };
    const m1 = mc('MC1'), m2 = mc('MC2');
    return {
      fioRunning: true,
      btnStart: this.panel.start, btnStop: this.panel.stop, btnReset: this.panel.reset,
      btnEStop: this.panel.estop, selAuto: this.panel.selAuto,
      ...v,
      y01Front: P.Y01 >= 0.98, y01Back: P.Y01 <= 0.02, y02Front: P.Y02 >= 0.98, y02Back: P.Y02 <= 0.02,
      y03Front: P.Y03 >= 0.98, y03Back: P.Y03 <= 0.02, y04Front: P.Y04 >= 0.98, y04Back: P.Y04 <= 0.02,
      mc1Busy: m1.busy, mc1Error: m1.error, mc1Opened: m1.opened, mc1Progress: m1.progress,
      mc2Busy: m2.busy, mc2Error: m2.error, mc2Opened: m2.opened, mc2Progress: m2.progress,
    };
  }

  // ---------------- Dinámica ----------------
  step(O, dt) {
    this.t += dt;
    this.emit(O, dt);
    this.movePushers(O, dt);
    this.moveMachines(O, dt);
    // De aguas abajo hacia aguas arriba, para que cada tramo vea el siguiente ya actualizado
    for (const id of ['M7', 'M9', 'M6', 'M8']) this.moveBelt(id, O[id.toLowerCase()], dt);
    for (const id of ['M4', 'M5']) this.moveBelt(id, O[id.toLowerCase()], dt);
    this.moveSorter(O, dt);
    this.moveBelt('M3', O.m3, dt);
    this.moveBelt('M1', O.m1, dt);
    this.moveBelt('M2', O.m2, dt);
    this.parts = this.parts.filter((p) => !p.removed);
    this.inputs = this.sense();
    return this.inputs;
  }

  spaceFree(lane, s, gap = PART_GAP) { return !this.parts.some((p) => p.lane === lane && Math.abs(p.s - s) < gap); }

  emit(O, dt) {
    for (const [id, e] of Object.entries(EMITTERS)) {
      this.emitTimer[id] -= dt;
      if (!O[id.toLowerCase()] || this.emitTimer[id] > 0) continue;
      if (!this.spaceFree(e.belt, e.s, 0.7)) continue;   // volumen del emisor ocupado
      let color = e.color;
      if (id === 'E1' && this.faults.unknownPart) { color = 'M'; this.faults.unknownPart = false; }
      this.parts.push({ id: this.nextId++, lane: e.belt, s: e.s, color, kind: 'raw', origin: e.color });
      this.emitted[id]++;
      this.emitTimer[id] = this.emitMin + this.rand() * (this.emitMax - this.emitMin);
    }
  }

  movePushers(O, dt) {
    const rate = dt / PUSHER_STROKE_S;
    for (const [id, cfg] of Object.entries(PUSHERS)) {
      const target = O[id.toLowerCase()] ? 1 : 0;
      let pos = this.pusherPos[id];
      pos += Math.sign(target - pos) * Math.min(rate, Math.abs(target - pos));
      if (this.faults[`${id.toLowerCase()}Stuck`]) pos = Math.min(pos, 0.5);
      this.pusherPos[id] = pos;
      if (pos > 0.55) {
        const p = this.parts.find((q) => q.lane === cfg.src && Math.abs(q.s - cfg.s) < PUSHER_REACH);
        if (p) {
          if (!this.spaceFree(cfg.dst, cfg.sDst, PART_GAP * 0.9)) this.collisions++;
          p.lane = cfg.dst; p.s = cfg.sDst;
        }
      }
    }
  }

  // Mueve las piezas de una faja respetando la separación física (acumulación)
  moveBelt(id, run, dt) {
    const L = LEN[id];
    const list = this.partsOn(id).sort((a, b) => b.s - a.s);
    let limit = Infinity;
    for (const p of list) {
      let ns = run ? p.s + BELT_SPEED * dt : p.s;
      ns = Math.min(ns, limit);
      if (ns >= L) {
        const handled = this.endOfBelt(id, p);
        if (handled) { limit = Infinity; continue; }
        ns = Math.min(ns, L - 0.2);   // tope al final de la faja
      }
      p.s = Math.max(p.s, ns);
      limit = p.s - PART_GAP;
    }
  }

  endOfBelt(id, p) {
    if (id === 'M3') {
      // La faja empuja la pieza sobre el wheel sorter (si está libre)
      if (this.parts.some((q) => q.lane === 'WS')) return false;
      p.lane = 'WS'; p.s = 0;
      return true;
    }
    const rem = Object.values(REMOVERS).find((r) => r.belt === id);
    if (rem) {
      if (this.faults[JAM_OF[id]]) return false;   // removedor bloqueado = atasco
      p.removed = true;
      this.delivered[rem.exit]++;
      const exp = EXIT_EXPECT[rem.exit];
      if (p.color !== exp.color || p.kind !== exp.kind) this.sortingErrors++;
      if (this.byOrigin[p.color]) this.byOrigin[p.color][p.kind]++;
      return true;
    }
    return false;   // M1, M2, M4, M5: tope
  }

  moveSorter(O, dt) {
    const p = this.parts.find((q) => q.lane === 'WS');
    if (!p) return;
    if (p.s < SORTER.pathIn) p.dir = O.wsLeft ? 'L' : O.wsRight ? 'R' : 'S';   // orientación de las ruedas
    if (!O.wsPlus) {
      // Ruedas abajo: la pieza solo avanza empujada por M3 hasta el centro y queda detenida
      if (O.m3) p.s = Math.min(SORTER.pathIn, p.s + BELT_SPEED * dt);
      return;
    }
    p.s += SORTER_SPEED * dt;
    if (p.s < SORTER_LEN) return;
    const leftBelt = 'M4', rightBelt = 'M5';
    const dst = p.dir === 'L' ? leftBelt : p.dir === 'R' ? rightBelt : null;
    if (!dst) { p.removed = true; this.lost++; return; }       // sin orientación: cae fuera de la línea
    if (!this.spaceFree(dst, 0.1)) { p.s = SORTER_LEN; return; }
    p.lane = dst; p.s = 0.1;
  }

  moveMachines(O, dt) {
    for (const [id, cfg] of Object.entries(MACHINES)) {
      const m = this.mc[id];
      const k = id === 'MC1' ? 'mc1' : 'mc2';
      if (O[`${k}Reset`]) m.error = false;
      if (O[`${k}Start`]) m.started = true;
      if (O[`${k}Stop`]) m.started = false;
      const halted = !m.started || m.error || this.faults[`${k}Error`] || this.faults[`${k}Door`];
      if (halted) continue;
      switch (m.state) {
        case 'idle': {
          const L = LEN[cfg.entryBelt];
          const p = this.parts.find((q) => q.lane === cfg.entryBelt && q.s >= L - 0.2 - SENSOR_TOL);
          if (!p) break;
          if (p.kind !== 'raw' || p.color === 'M') { m.error = true; break; }   // Has Error: pieza inválida
          p.lane = id; m.part = p; m.state = 'loading'; m.timer = MC_TIMES.load; m.progress = 0;
          m.lids = !!O[`${k}Lids`];
          break;
        }
        case 'loading':
          m.timer -= dt;
          if (m.timer <= 0) { m.state = 'machining'; m.total = m.lids ? MC_TIMES.lid : MC_TIMES.base; m.timer = m.total; }
          break;
        case 'machining':
          m.timer -= dt;
          m.progress = Math.min(100, 100 * (1 - m.timer / m.total));
          if (m.timer <= 0) { m.part.kind = m.lids ? 'lid' : 'base'; m.state = 'unloading'; m.timer = MC_TIMES.unload; m.progress = 100; }
          break;
        case 'unloading':
          m.timer -= dt;
          if (m.timer <= 0 && this.spaceFree(cfg.exitBelt, 0.2, PART_GAP + 0.1)) {
            m.part.lane = cfg.exitBelt; m.part.s = 0.2; m.part = null; m.state = 'idle'; m.progress = 0;
          }
          break;
      }
    }
  }

  // Retira a mano las piezas de una zona (para recuperar fallas en la demo)
  clearZone(zone) {
    const lanes = { sorter: ['WS'], mc1: ['M4'], mc2: ['M5'] }[zone] || [];
    this.parts = this.parts.filter((p) => !lanes.includes(p.lane) || !(zone !== 'sorter' ? p.s >= LEN[p.lane] - 0.5 : true));
    if (zone === 'mc1') this.mc.MC1.error = false;
    if (zone === 'mc2') this.mc.MC2.error = false;
  }

  snapshotParts() {
    return this.parts.map((p) => ({ id: p.id, lane: p.lane, s: +p.s.toFixed(3), color: p.color, kind: p.kind, dir: p.dir }));
  }
}

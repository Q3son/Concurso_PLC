// Pruebas de la lógica de control (espejo de PLC_PRG) sobre el gemelo digital de la planta.
// Cada prueba corresponde a una observación del jurado o a un requisito de las bases.
// Ejecutar: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FactorySim } from '../public/js/simulator.js';
import { STATE, SORTER_STEP, maskHas } from '../public/js/constants.js';

const started = (opts = {}) => {
  const s = new FactorySim({ seed: 2026, ...opts });
  s.run(0.5);
  s.command('start');
  return s;
};

test('produce tapas y bases de los dos colores sin errores de segregación (4 min)', () => {
  const s = started();
  s.run(240);
  const n = s.snapshot();
  assert.equal(n.state, STATE.AUTO_RUN);
  assert.equal(s.plant.sortingErrors, 0, 'ningún producto en una salida equivocada');
  assert.equal(s.plant.collisions, 0, 'sin choques al empujar a la faja principal');
  assert.equal(s.plant.lost, 0, 'ninguna pieza se cae del wheel sorter');
  for (const k of ['blueLids', 'greenLids', 'blueBases', 'greenBases']) assert.ok(n.kpi[k] >= 8, `${k} = ${n.kpi[k]}`);
  assert.ok(n.kpi.ppm >= 12, `throughput >= 12 productos/min (${n.kpi.ppm})`);
  assert.equal(n.alarms.active, 0, 'sin alarmas en operación normal');
});

test('regla del wheel sorter: cada color alterna tapas, bases, tapas…', () => {
  const s = started({ seed: 7 });
  const seq = { 1: [], 2: [] };
  const W = s.plc.fbSorter;
  for (let i = 0; i < 18000; i++) {          // 180 s en ciclos de 10 ms
    s.step(0.01);
    if (W.xDone) seq[W.eDoneColor].push(W.eDoneBranch);
  }
  for (const c of [1, 2]) {
    assert.ok(seq[c].length >= 10, `color ${c}: ${seq[c].length} piezas`);
    assert.equal(seq[c][0], 1, 'el primer crudo de cada color va a tapas');
    seq[c].forEach((b, i) => assert.equal(b, i % 2 === 0 ? 1 : 2, `color ${c}, pieza ${i + 1}`));
  }
  // Consecuencia física: cada color produce la misma cantidad de tapas y de bases (±1)
  const o = s.plant.byOrigin;
  assert.ok(Math.abs(o.G.lid - o.G.base) <= 1 && Math.abs(o.B.lid - o.B.base) <= 1, JSON.stringify(o));
});

test('la unión alterna las fajas 1 (verde) y 2 (azul) y confirma cada caída con S5', () => {
  for (const seed of [1, 42, 99]) {
    const s = started({ seed });
    s.run(180);
    const k = s.snapshot().kpi;
    assert.equal(s.plant.collisions, 0, `sin choques (semilla ${seed})`);
    assert.ok(k.fedGreen >= 10 && k.fedBlue >= 10, `ambas fajas alimentan (${k.fedGreen}/${k.fedBlue})`);
    assert.ok(Math.abs(k.fedGreen - k.fedBlue) <= 2, 'reparto equilibrado por turnos');
  }
});

test('lote: se alimentan exactamente X verdes e Y azules y la celda termina sola', () => {
  const s = new FactorySim({ seed: 5 });
  s.run(0.5);
  s.command('setLot', { green: 4, blue: 6 });
  s.run(0.1);
  s.command('start');
  s.run(240);
  const n = s.snapshot();
  assert.equal(n.state, STATE.IDLE, 'vuelve a IDLE al terminar el lote');
  assert.equal(n.lot.completed, true);
  assert.equal(n.kpi.fedGreen, 4);
  assert.equal(n.kpi.fedBlue, 6);
  assert.equal(n.kpi.greenLids + n.kpi.greenBases, 4, 'todos los verdes salieron como producto');
  assert.equal(n.kpi.blueLids + n.kpi.blueBases, 6, 'todos los azules salieron como producto');
  assert.equal(s.plant.sortingErrors, 0);
});

test('Stop: parada controlada corta la alimentación y termina lo que está en proceso', () => {
  const s = started();
  s.run(60);
  s.command('stop');
  s.run(0.1);
  assert.equal(s.snapshot().state, STATE.AUTO_STOP);
  const fed = s.snapshot().kpi.fedGreen + s.snapshot().kpi.fedBlue;
  s.run(90);
  const n = s.snapshot();
  assert.equal(n.state, STATE.IDLE);
  assert.equal(n.onMain + n.lidsQueue + n.basesQueue, 0, 'línea vacía');
  assert.ok(n.kpi.fedGreen + n.kpi.fedBlue <= fed + 1, 'no se alimentan piezas nuevas');
  assert.equal(n.kpi.total, n.kpi.fedGreen + n.kpi.fedBlue, 'todo lo alimentado salió como producto');
});

test('paro de emergencia corta todos los actuadores y exige Reset tras liberar', () => {
  const s = started();
  s.run(30);
  s.command('estop', true);
  s.run(0.1);
  let n = s.snapshot();
  assert.equal(n.state, STATE.EMERGENCY);
  const O = n.outputs;
  for (const k of ['e1', 'e2', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'y01', 'y02', 'y03', 'y04', 'wsPlus', 'mc1Start', 'mc2Start']) {
    assert.equal(O[k], false, `${k} apagado`);
  }
  assert.equal(O.mc1Stop && O.mc2Stop, true, 'los centros de mecanizado reciben Stop');
  assert.ok(maskHas(n.alarms.active, 1));
  s.command('estop', false);
  s.run(1);
  assert.equal(s.snapshot().state, STATE.EMERGENCY, 'sigue bloqueada sin Reset');
  s.command('reset');
  s.run(0.5);
  n = s.snapshot();
  assert.equal(n.state, STATE.IDLE);
  assert.equal(n.alarms.active, 0);
  s.command('start');
  s.run(60);
  assert.equal(s.snapshot().state, STATE.AUTO_RUN, 'reanuda la producción');
  assert.equal(s.plant.sortingErrors, 0, 'sin perder el seguimiento');
});

test('pusher Y01 trabado: falla por tiempo excedido y recuperación con Reset', () => {
  const s = started();
  s.command('y01Stuck', true);
  s.run(30);
  let n = s.snapshot();
  assert.equal(n.state, STATE.FAULT);
  assert.ok(maskHas(n.alarms.active, 2), 'alarma 2: Y01 no llegó adelante');
  s.command('y01Stuck', false);
  s.run(1);
  s.command('reset');
  s.run(0.5);
  assert.equal(s.snapshot().state, STATE.IDLE);
  s.command('start');
  s.run(30);
  n = s.snapshot();
  assert.equal(n.state, STATE.AUTO_RUN);
});

test('pieza no identificada (ni verde ni azul) detiene el sorter con alarma 11', () => {
  const s = started();
  s.command('unknownPart', true);
  s.run(60);
  let n = s.snapshot();
  assert.equal(n.state, STATE.FAULT);
  assert.ok(maskHas(n.alarms.active, 11));
  assert.equal(n.sorterStep, SORTER_STEP.ERROR);
  s.command('removeSorterPart');
  s.command('reset');
  s.run(0.5);
  assert.equal(s.snapshot().state, STATE.IDLE);
  s.command('start');
  s.run(60);
  n = s.snapshot();
  assert.equal(n.state, STATE.AUTO_RUN);
  assert.equal(s.plant.sortingErrors, 0);
});

test('error y puerta abierta del centro de mecanizado generan falla', () => {
  const s = started();
  s.run(20);
  s.command('mc2Door', true);
  s.run(0.5);
  let n = s.snapshot();
  assert.equal(n.state, STATE.FAULT);
  assert.ok(maskHas(n.alarms.active, 16));
  s.command('mc2Door', false);
  s.command('reset');
  s.run(0.5);
  s.command('mc1Error', true);
  s.run(0.5);
  n = s.snapshot();
  assert.ok(maskHas(n.alarms.active, 13));
});

test('atasco en la salida de bases verdes detectado por S15', () => {
  const s = started();
  s.command('jamGreenBases', true);
  s.run(150);
  const n = s.snapshot();
  assert.equal(n.state, STATE.FAULT);
  assert.ok(maskHas(n.alarms.active, 20));
});

test('modo manual: los actuadores solo responden en MANUAL y se apagan al salir', () => {
  const s = new FactorySim();
  s.run(0.2);
  s.command('manM3', true);
  s.run(0.2);
  assert.equal(s.snapshot().outputs.m3, false, 'en IDLE no obedece mandos manuales');
  s.command('modeManual');
  s.run(0.2);
  assert.equal(s.snapshot().state, STATE.MANUAL);
  s.command('manM3', true);
  s.command('manWSPlus', true);
  s.command('manWSLeft', true);
  s.command('manPushY03');
  s.run(0.3);
  let n = s.snapshot();
  assert.equal(n.outputs.m3, true);
  assert.equal(n.outputs.wsPlus && n.outputs.wsLeft, true);
  assert.equal(n.outputs.y03, true);
  s.run(2);
  s.command('modeAuto');
  s.run(0.2);
  n = s.snapshot();
  assert.equal(n.state, STATE.IDLE);
  assert.equal(n.outputs.m3 || n.outputs.wsPlus, false);
});

test('las fajas solo marchan cuando tienen piezas (ahorro de energía)', () => {
  const s = new FactorySim({ seed: 3 });
  s.run(0.5);
  s.command('setLot', { green: 1, blue: 0 });
  s.run(0.1);
  s.command('start');
  s.run(5);
  const o = s.snapshot().outputs;
  assert.equal(o.m4 || o.m5 || o.m6 || o.m7 || o.m8 || o.m9, false, 'aguas abajo sin piezas: fajas detenidas');
});

test('robustez: sin bloqueos ni errores con parámetros y ritmos de emisión extremos', () => {
  const cases = [
    { tSorterSettle: 0, tMergeGap: 1.0, iBranchCapacity: 3, iMainCapacity: 5 },
    { tSorterSettle: 1.0, tMergeGap: 3.0, iBranchCapacity: 1, iMainCapacity: 2 },
    { tSorterSettle: 0.3, tMergeGap: 1.0, iBranchCapacity: 5, iMainCapacity: 8 },
    { tSorterSettle: 0, tMergeGap: 1.0, iBranchCapacity: 1, iMainCapacity: 5 },
  ];
  for (const param of cases) {
    for (const [emitMin, emitMax] of [[0.3, 0.6], [2, 4]]) {
      const s = new FactorySim({ seed: 1, param, emitMin, emitMax });
      s.run(0.5);
      s.command('start');
      s.run(300);
      const n = s.snapshot();
      const tag = JSON.stringify({ ...param, emitMin });
      assert.equal(n.state, STATE.AUTO_RUN, `sigue produciendo ${tag}`);
      assert.equal(s.plant.sortingErrors + s.plant.collisions + s.plant.lost, 0, tag);
      assert.ok(n.kpi.total >= 20, `${tag}: ${n.kpi.total} productos`);
    }
  }
});

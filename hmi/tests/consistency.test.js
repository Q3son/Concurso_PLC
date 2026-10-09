// Coherencia entre el código del PLC (plc/codesys/*.st) y el resto del repositorio:
// mapa de E/S, variables leídas por OPC UA, parámetros del espejo JS y alarmas.
// Si alguien cambia una variable en CODESYS y olvida el tablero (o al revés), esta prueba falla.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DI, AI, DO, AO } from '../public/js/iomap.js';
import { READ_TAGS, COMMANDS } from '../src/tags.js';
import { DEFAULT_PARAM } from '../public/js/control.js';
import { ALARMS } from '../public/js/constants.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const st = (rel) => readFileSync(path.join(root, 'plc/codesys', rel), 'utf8');

// Variables declaradas en un GVL: "nombre : TIPO ...; (* comentario *)"
function gvlVars(src) {
  const out = new Map();
  for (const line of src.split('\n')) {
    const m = line.match(/^\s*([A-Za-z_]\w*)\s*:\s*([A-Za-z_][\w()\[\].\s]*?)\s*(?::=\s*([^;]+))?;\s*(?:\(\*(.*)\*\))?/);
    if (m && !/^(VAR|END_VAR|TYPE|END_TYPE)/.test(m[1])) out.set(m[1], { type: m[2].trim(), init: m[3]?.trim(), comment: m[4] || '' });
  }
  return out;
}

const GVL = {
  GVL_IO: gvlVars(st('02_GVL/GVL_IO.st')),
  GVL_HMI: gvlVars(st('02_GVL/GVL_HMI.st')),
  GVL_Param: gvlVars(st('02_GVL/GVL_Param.st')),
};

test('GVL_IO coincide con iomap.js (nombre, orden y dirección Modbus)', () => {
  const ordered = [...GVL.GVL_IO.entries()];
  const groups = [['BOOL', DI, 0], ['INT', AI, DI.length], ['BOOL', DO, DI.length + AI.length], ['INT', AO, DI.length + AI.length + DO.length]];
  for (const [type, list, offset] of groups) {
    list.forEach((d, i) => {
      const [name, v] = ordered[offset + i] ?? [];
      assert.equal(name, d.plc, `posición ${offset + i}: se esperaba ${d.plc}`);
      assert.equal(v.type, type, `${d.plc} es ${type}`);
      const addr = Number(v.comment.trim().split(/\s+/)[0]);
      assert.equal(addr, d.addr, `${d.plc}: dirección Modbus del comentario`);
    });
  }
  assert.equal(ordered.length, DI.length + AI.length + DO.length + AO.length, 'sin variables de más en GVL_IO');
});

test('todas las variables que lee o escribe el tablero existen en el PLC', () => {
  const exists = (p) => {
    const [gvl, name] = p.split('.');
    return GVL[gvl]?.has(name);
  };
  for (const [, p] of READ_TAGS) assert.ok(exists(p), `falta ${p}`);
  for (const [name, def] of Object.entries(COMMANDS)) {
    for (const p of def.lot ? [def.green, def.blue, def.apply] : [def.path]) assert.ok(exists(p), `${name}: falta ${p}`);
  }
});

test('los parámetros del espejo JS son los mismos que GVL_Param', () => {
  const toNum = (v) => {
    if (/^T#/i.test(v)) {
      const m = v.match(/T#(\d+)(MS|S)/i);
      return m[2].toUpperCase() === 'MS' ? Number(m[1]) / 1000 : Number(m[1]);
    }
    if (v === 'TRUE') return true;
    if (v === 'FALSE') return false;
    return Number(v);
  };
  for (const [name, v] of GVL.GVL_Param) {
    if (!v.init) continue;
    assert.ok(name in DEFAULT_PARAM, `DEFAULT_PARAM no tiene ${name}`);
    assert.equal(DEFAULT_PARAM[name], toNum(v.init), `${name}: PLC ${v.init} vs JS ${DEFAULT_PARAM[name]}`);
  }
});

test('las alarmas del tablero coinciden con las del PLC', () => {
  const prg = st('05_PRG/PLC_PRG.st');
  const texts = [...prg.matchAll(/aAlarm\[(\d+)\]\.sText\s*:=\s*'([^']+)'/g)].map((m) => Number(m[1]));
  assert.deepEqual(texts, ALARMS.map((a) => a.id), 'mismo número y orden');
  assert.equal(ALARMS.length, DEFAULT_PARAM.ALARM_COUNT);
  const cls = Object.fromEntries([...prg.matchAll(/aAlarm\[(\d+)\]\.eClass\s*:=\s*E_AlarmClass\.(\w+)/g)].map((m) => [Number(m[1]), m[2]]));
  for (const a of ALARMS) {
    const expected = a.kind === 'emergency' ? 'EMERGENCY' : a.kind === 'warning' ? 'WARNING' : 'FAULT';
    if (cls[a.id]) assert.equal(cls[a.id], expected, `alarma ${a.id}`);
  }
});

test('cada POU del PLC está documentado en el orden de importación', () => {
  const doc = readFileSync(path.join(root, 'docs/04-codesys.md'), 'utf8');
  for (const name of ['E_Color', 'E_Branch', 'E_SorterStep', 'FB_FeederStation', 'FB_WheelSorter',
    'FB_MachiningCenter', 'FB_ColorDiverter', 'FC_ColorFromSensors', 'FC_FifoPack']) {
    assert.ok(doc.includes(name), `docs/04-codesys.md menciona ${name}`);
  }
});

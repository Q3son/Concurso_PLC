// Genera la escena de Factory I/O (factoryio/SmartFactory_TapasBases.factoryio) desde código.
// Uso: cd hmi && npm run escena
//
// El archivo .factoryio es XML: cada pieza es un <Object> con su tipo (PrefabName), posición,
// rotación y tags; la sección <Drivers> asigna cada tag a una dirección del driver.
// Plantillas tomadas de escenas guardadas con Factory I/O 2.5.10 (factoryio/ref/):
//   - 1 unidad de posición = 0,125 m; el origen de cada faja es su centro.
//   - Las fajas avanzan en su eje Forward; los pushers empujan en su eje Right;
//     los sensores difusos miran en su eje Right.
//   - Centro de mecanizado: la faja de entrada termina en C - 22F + 11R y la de salida
//     empieza en C + 23F + 11R (F = Forward, R = Right del centro).
// El mapa de E/S sale de hmi/public/js/iomap.js: misma dirección Modbus que GVL_IO.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DI, AI, DO, AO } from '../hmi/public/js/iomap.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = path.join(root, 'factoryio/ref/production_line_2.5.10.factoryio');
// La escena oficial (factoryio/SmartFactory_TapasBases.factoryio) tiene ajustes hechos a mano en
// Factory I/O (ruedas dobles en las entradas, removedores): el generador escribe otra copia.
const OUT = path.join(root, 'factoryio/SmartFactory_TapasBases_generada.factoryio');
const U = 0.125; // m por unidad

// ---------------------------------------------------------------- utilidades
const uuid = (seed) => {
  const h = createHash('sha1').update('smart-factory/' + seed).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const num = (v) => (Math.abs(v) < 1e-9 ? '0' : String(+v.toFixed(7)));
const esc = (s) => s.replace(/→/g, '->').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
// Giro alrededor del eje vertical (grados). 0 = Forward +Z, 90 = +X, 180 = -Z, -90 = -X.
function frame(deg) {
  const t = (deg * Math.PI) / 180;
  return {
    q: [0, Math.sin(t / 2), 0, Math.cos(t / 2)],
    F: [Math.sin(t), 0, Math.cos(t)],
    R: [Math.cos(t), 0, -Math.sin(t)],
  };
}
const v3 = (n, [x, y, z]) => `<${n} X="${num(x)}" Y="${num(y)}" Z="${num(z)}" />`;

// ---------------------------------------------------------------- tags y mapa
const ioByKey = new Map();
for (const [kind, list] of Object.entries({ DI, AI, DO, AO })) for (const d of list) ioByKey.set(d.key, { ...d, kind });
const used = new Map(); // key de iomap -> Key del tag
let spare = { BinaryInput: 60, BinaryOutput: 60 };

// t('sFeed1Ready') -> tag mapeado; t(null, 'BinaryInput', 'nombre') -> tag sin mapear
function tag(ioKey, xmlKind, name, forced) {
  if (ioKey) {
    const d = ioByKey.get(ioKey);
    if (!d) throw new Error(`iomap no tiene ${ioKey}`);
    const kind = xmlKind ?? { DI: 'BinaryInput', DO: 'BinaryOutput', AI: 'IntInput', AO: 'IntOutput' }[d.kind];
    const key = uuid('tag/' + ioKey);
    used.set(ioKey, key);
    return { kind, name: name ?? `${d.code} ${d.label}`, addr: d.addr, key, forced };
  }
  return { kind: xmlKind, name, addr: spare[xmlKind]++, key: uuid('tag/' + name), forced };
}
function tagXml(t) {
  const isInt = /^Int/.test(t.kind);
  const fv = t.forced !== undefined ? t.forced : isInt ? '0' : 'False';
  const uf = t.forced !== undefined ? 'True' : 'False';
  return `<${t.kind} Name="${esc(t.name)}" Address="${t.addr}" Key="${t.key}" OpenCircuit="False" ShortCircuit="False" UseForcedValue="${uf}" ForcedValue="${fv}" />`;
}

// ---------------------------------------------------------------- piezas
const objects = [];
const index = {};
function obj(prefab, id, [x, y, z], deg, { om, groups, extra = [], color, noIO } = {}) {
  const { q, F, R } = frame(deg);
  const idx = noIO ? -1 : (index[prefab] = (index[prefab] ?? -1) + 1);
  const L = [];
  L.push('  <Object Locked="False" GroupKey="00000000-0000-0000-0000-000000000000">');
  L.push(`    <Proxy PrefabName="${prefab}" Key="${uuid('obj/' + id)}">`);
  L.push(`      ${v3('Position', [Math.round(x), Math.round(y), Math.round(z)])}`);
  L.push(`      <Rotation X="${num(q[0])}" Y="${num(q[1])}" Z="${num(q[2])}" W="${num(q[3])}" />`);
  L.push('      <FineRotation>0</FineRotation>', '      <FinePosition>0</FinePosition>');
  L.push(`      ${v3('Forward', F)}`, '      <Up X="0" Y="1" Z="0" />', `      ${v3('Right', R)}`);
  L.push('    </Proxy>');
  L.push(`    <ComponentIO Index="${idx}" CurrentOperatingMode="${om?.mode ?? 0}"${color !== undefined ? ` Color="${color}"` : ''} />`);
  if (om) {
    L.push(`    <OperatingMode Description="${om.desc}">`);
    for (const [desc, tags] of groups) {
      L.push(`      <GroupIO Description="${desc}">`);
      for (const t of tags) L.push(`        ${tagXml(t)}`);
      L.push('      </GroupIO>');
    }
    L.push('    </OperatingMode>');
  }
  for (const e of extra) L.push(`    ${e}`);
  L.push('  </Object>');
  objects.push(L.join('\n'));
}

const SENSOR = { desc: '$C_DefaultSensor_OM_Binary_NAME' };
const belt = (id, len, p, deg, io) =>
  obj(`BeltConveyor${len}M`, id, [p[0], 3, p[1]], deg, {
    om: { desc: '$C_BeltConveyor_OM_SingleBinary_NAME' }, groups: [['Default', [tag(io)]]],
    extra: ['<Encoder Enabled="False" />'],
  });
const emitter = (id, p, deg, io, part) =>
  obj('Emitter', id, [p[0], 9, p[1]], deg, {
    om: { desc: '$C_Emitter_OM_Default_NAME' }, groups: [['Default', [tag(io)]]],
    extra: [
      '<Emitter MinTimeToEmit="1" MaxTimeToEmit="2" UpTo="0" RandomPartPosition="False" RandomPartOrientation="False">',
      '  <Bases />', `  <Parts ${part}="True" />`, '</Emitter>',
    ],
  });
const pusher = (id, p, deg, io, front, back) =>
  obj('Pusher', id, [p[0], 6, p[1]], deg, {
    om: { desc: '$C_Pusher_OM_Monostable_NAME' },
    groups: [['Default', [tag(io)]], ['Front', [tag(front)]], ['Back', [tag(back)]]],
  });
const diffuse = (id, p, deg, io, range = 1) =>
  obj('DiffusePhotoelectricSensor', id, [p[0], 8, p[1]], deg, {
    om: SENSOR, groups: [['Default', [tag(io)]]], extra: [`<Sensor Range="${range}" />`],
  });
const capacitive = (id, p, deg, io) =>
  obj('CapacitiveSensor', id, [p[0], 8, p[1]], deg, {
    om: SENSOR, groups: [['Default', [tag(io)]]], extra: ['<Sensor Range="0.3" />'],
  });
const VISION = { GreenRaw: 7, BlueRaw: 6, GreenLids: 4, GreenBases: 1 };
const vision = (id, p, deg, io, what) =>
  obj('VisionSensor', id, [p[0], 12, p[1]], deg, {
    om: { desc: `$C_VisionSensor_OM_Detects${what === 'GreenRaw' ? 'GreenRawMaterial' : what === 'BlueRaw' ? 'BlueRawMaterial' : what}_NAME`, mode: VISION[what] },
    groups: [['Default', [tag(io)]]], extra: ['<Sensor Range="2" />'],
  });
const remover = (id, p) =>
  obj('Remover', id, [p[0], 4, p[1]], 0, {
    om: { desc: '$C_Remover_OM_Default_NAME' },
    groups: [['Default', [tag(null, 'BinaryOutput', `${id} (Remove)`, 'True')]]],
    extra: [
      '<Remover>', '  <Bases Pallet="True" SquarePallet="True" StackableBox="True" />',
      '  <Parts BoxS="True" BoxM="True" BoxL="True" PalletizingBox="True" RawMaterialBlue="True" RawMaterialGreen="True" RawMaterialMetal="True" ProductBaseBlue="True" ProductBaseGreen="True" ProductBaseMetal="True" ProductLidBlue="True" ProductLidGreen="True" ProductLidMetal="True" StackableBox="True" />',
      '</Remover>',
    ],
  });

// Centro de mecanizado + sensor retrorreflectivo de entrada (como en la escena Production Line)
function machine(id, beltEnd, deg, n, entryIo) {
  const { F, R } = frame(deg);
  const at = (base, r, f) => [base[0] + r * R[0] + f * F[0], base[2] + r * R[2] + f * F[2]];
  // Como en Production Line: la faja de entrada termina 22 unidades antes del centro (sin hueco).
  const C = [beltEnd[0] + 22 * F[0] - 11 * R[0], 0, beltEnd[1] + 22 * F[2] - 11 * R[2]];
  const m = `mc${n}`;
  obj('MachiningCenter', id, [C[0], 9, C[2]], deg, {
    om: { desc: '$C_OM_Default_NAME' },
    groups: [
      ['produceLids', [tag(`${m}Lids`)]], ['start', [tag(`${m}Start`)]], ['stop', [tag(`${m}Stop`)]],
      ['reset', [tag(`${m}Reset`)]], ['isBusy', [tag(`${m}Busy`)]], ['hasError', [tag(`${m}Error`)]],
      ['door', [tag(`${m}Opened`)]], ['progress', [tag(`${m}Progress`)]],
    ],
  });
  // S8/S9 tres unidades dentro de la ventana: la faja sigue empujando hasta dejar la pieza en la
  // bahía donde la toma el robot. La pieza debe llegar centrada (alineadores al final de la rama).
  const s = at(C, 15, -20), mir = at(C, 7, -20);
  obj('MetalCorner', `${id}-corner-s`, [s[0], 7, s[1]], deg, { noIO: true, color: 7 });
  // S8/S9: sensor difuso en la bahía de entrada, mirando a través de ella (0,6 m, sin llegar al
  // otro lado). La barrera retrorreflectiva de Production Line quedaba en TRUE con la bahía vacía.
  obj('DiffusePhotoelectricSensor', `${id}-entry`, [s[0], 8, s[1]], deg + 180, {
    om: SENSOR, groups: [['Default', [tag(entryIo)]]], extra: ['<Sensor Range="0.6" />'],
  });
  return [C[0] + 23 * F[0] + 11 * R[0], C[2] + 23 * F[2] + 11 * R[2]]; // inicio de la faja de salida
}

// ---------------------------------------------------------------- disposición
// Eje de la celda: M3 avanza en +X hacia el wheel sorter (WS1). Lado +Z = izquierda del sorter
// = rama de TAPAS (GVL_Param.xLidsOnLeft = TRUE). Lado -Z = rama de BASES.
const XS = 260, ZS = 140; // centro del wheel sorter

// Zona 1: alimentación (E1/E2 -> M1/M2 -> Y01/Y02 -> M3)
emitter('E1', [196, ZS - 8], 90, 'e1', 'RawMaterialGreen');
emitter('E2', [196, ZS + 8], 90, 'e2', 'RawMaterialBlue');
belt('M1', 4, [208, ZS - 8], 90, 'm1');
belt('M2', 4, [208, ZS + 8], 90, 'm2');
pusher('Y01', [218, ZS - 14], -90, 'y01', 'y01Front', 'y01Back');
pusher('Y02', [218, ZS + 14], 90, 'y02', 'y02Front', 'y02Back');
// S2/S4 al final de M1/M2 mirando hacia atrás a lo largo de la faja: junto al pusher detectaban
// su propia placa. Alcance 0,85 m: la pieza se detiene centrada frente a Y01/Y02 (x = 218).
// Y01/Y02 empujan 10 unidades (1,25 m) después del inicio de M3: la pieza cae entera sobre la faja.
diffuse('S2', [225, ZS - 8], 180, 'sFeed1Ready', 1.1);
diffuse('S4', [225, ZS + 8], 180, 'sFeed2Ready', 1.1);
belt('M3', 6, [XS - 28, ZS], 90, 'm3');
// S5 en el borde +Z de M3 mirando a través de la faja: 0,85 m cubre ambos lados (verde de Y01 y azul de Y02)
diffuse('S5', [228, ZS + 4], 90, 'sMainDrop', 0.85);

// Alineadores de ruedas (WheelAligner) a ambos lados de M3, entre S5 y la visión: encauzan la
// pieza al centro de la faja para que S6.1/S6.2 la lean y entre recta al sorter.
// Misma disposición que en Production Line (par a -4 y +5 unidades del eje de la faja).
obj('WheelAligner', 'AL1', [236, 8, ZS + 4], 90, { noIO: true, color: 7 });
obj('WheelAligner', 'AL2', [236, 8, ZS - 5], 90, { noIO: true, color: 7 });

// Zona 2: identificación y wheel sorter
vision('S6.1', [237, ZS - 1], 90, 'sGreenRaw', 'GreenRaw');
vision('S6.2', [237, ZS + 1], 90, 'sBlueRaw', 'BlueRaw');
obj('PopUpWheelSorter', 'WS1', [XS, 5, ZS], 90, {
  om: { desc: '$C_PopUpWheelSorter_OM_SingleBinary_NAME' },
  groups: [['Left', [tag('wsLeft')]], ['Right', [tag('wsRight')]], ['Forward', [tag('wsPlus')]]],
});
diffuse('S7', [XS + 5, ZS], 180, 'sSorter', 0.7);

// Zona 3 y 4, rama de tapas (+Z): M4 -> MC1 -> M6 (azules siguen) / Y03 -> M7 (verdes)
belt('M4', 4, [XS, ZS + 20], 0, 'm4');
// Alineadores al final de la rama: centran la pieza para que pase por la ventana de la máquina
obj('WheelAligner', 'AL3', [XS + 4, 8, ZS + 30], 0, { noIO: true, color: 7 });
obj('WheelAligner', 'AL4', [XS - 5, 8, ZS + 30], 0, { noIO: true, color: 7 });
const out1 = machine('MC1', [XS, ZS + 36], 0, 1, 'sLidsEntry');
belt('M6', 6, [out1[0], out1[1] + 24], 0, 'm6');
const zp = out1[1] + 29;
vision('S10', [XS, zp - 2], 0, 'sGreenLid', 'GreenLids');
pusher('Y03', [XS - 7, zp], 0, 'y03', 'y03Front', 'y03Back');
belt('M7', 4, [XS + 20, zp], 90, 'm7');
capacitive('S12', [XS + 3, out1[1] + 41], 180, 'sBlueLids');
capacitive('S13', [XS + 29, zp - 3], -90, 'sGreenLids');
// Removedores SOBRE el final de cada faja (no después): la faja puede terminar contra una reja
remover('R1', [XS, out1[1] + 45]);
remover('R2', [XS + 33, zp]);

// Rama de bases (-Z): M5 -> MC2 -> M8 (azules siguen) / Y04 -> M9 (verdes)
belt('M5', 4, [XS, ZS - 20], 180, 'm5');
obj('WheelAligner', 'AL5', [XS + 4, 8, ZS - 30], 180, { noIO: true, color: 7 });
obj('WheelAligner', 'AL6', [XS - 5, 8, ZS - 30], 180, { noIO: true, color: 7 });
const out2 = machine('MC2', [XS, ZS - 36], 180, 2, 'sBasesEntry');
belt('M8', 6, [out2[0], out2[1] - 24], 180, 'm8');
const zq = out2[1] - 29;
vision('S11', [XS, zq + 2], 180, 'sGreenBase', 'GreenBases');
pusher('Y04', [XS + 7, zq], 180, 'y04', 'y04Front', 'y04Back');
belt('M9', 4, [XS - 20, zq], -90, 'm9');
capacitive('S14', [XS - 3, out2[1] - 41], 0, 'sBlueBases');
capacitive('S15', [XS - 29, zq + 3], 90, 'sGreenBases');
remover('R3', [XS, out2[1] - 45]);
remover('R4', [XS - 33, zq]);

// Panel del operador (misma disposición relativa que el tablero de las escenas de Factory I/O)
const B = [196, 8, ZS + 40];
obj('ElectricSwitchboard', 'Panel', B, 180, { noIO: true });
const btn = (prefab, id, dy, df, groups, desc, color) =>
  obj(prefab, id, [B[0] - 2, B[1] + dy, B[2] - df], 180, { om: { desc }, groups, color });
const PUSH = '$C_PushButton_OM_MomentaryAction_NAME';
btn('StartPushButton', 'PB1', 0, -1, [['Default', [tag('btnStart'), tag('lampStart')]]], PUSH, 0);
btn('StopPushButton', 'PB2', 0, 0, [['Default', [tag('btnStop'), tag('lampStop')]]], PUSH, 0);
btn('ResetPushButton', 'PB3', 0, 1, [['Default', [tag('btnReset'), tag('lampReset')]]], PUSH, 0);
btn('EmergencyStopButton', 'ES1', 1, 0, [['Default', [tag('btnEStop')]]], '$C_OM_Default_NAME');
btn('Selector', 'SW1', -1, -1, [['Default', [tag('selAuto')]], ['State0', [tag(null, 'BinaryInput', 'SW1 Manual (State 0)')]]], '$C_Selector_Type1_NAME');
obj('DigitalDisplay', 'D1', [B[0] - 2, B[1] - 1, B[2]], 180, {
  om: { desc: '$C_DigitalDisplay_OM_Int_NAME', mode: 2 }, groups: [['Default', [tag('display')]]],
});
obj('VisualStatusIndicator', 'Stack', [B[0] + 6, 0, B[2]], 180, {
  om: { desc: '$C_OM_Default_NAME' },
  groups: [['Red', [tag('lampRed')]], ['Yellow', [tag('lampYellow')]], ['Green', [tag('lampGreen')]]],
});

// ---------------------------------------------------------------- archivo
const base = readFileSync(BASE, 'utf8').replace(/^﻿/, '');
const NL = '\n';
const head = base.slice(0, base.indexOf('  <Object')).replace(/<Camera>[\s\S]*?<\/Camera>/, () => {
  const cam = (name, c, p) => [
    `    <CameraPosition Name="${name}" Type="OrbitCamera">`, '      <Data>',
    `        ${v3('CameraPosition', c)}`, `        ${v3('PivotPosition', p)}`, '      </Data>', '    </CameraPosition>',
  ].join(NL);
  const center = [XS * U - 2, 0.0625, ZS * U];
  return ['<Camera>',
    cam('Celda completa', [center[0] - 14, 16, center[2]], center),
    cam('Panel del operador', [(B[0] - 9) * U, 1.6, B[2] * U], [(B[0] - 2) * U, 1.2, B[2] * U]),
    cam('Alimentacion y union', [24, 4, 12], [26.5, 0.8, 17.5]),
    cam('Wheel sorter', [30, 4, 13], [32.5, 0.8, 17.5]),
    cam('Current', [center[0] - 14, 16, center[2]], center),
    '  </Camera>'].join(NL);
}).replace(/<Description Data="[^"]*"/, '<Description Data="Smart Factory Challenge HRFEST 2026: tapas y bases con segregacion por color. Generada con tools/generar-escena-fio.mjs"');

let tail = base.slice(base.lastIndexOf('</Object>') + '</Object>'.length);
// Limpiar el mapeo de todos los drivers y escribir el de Modbus TCP/IP Client
tail = tail.replace(/\r?\n\s*<(Bit|Int|Float|Numeric)(Input|Output)\d+ PointIOKey="[^"]*" \/>/g, '');
const runKey = /RunInputKey="([^"]+)"/.exec(tail)[1];
const slots = [];
for (const d of DI) slots.push(`<BitInput${d.addr} PointIOKey="${d.key === 'fioRunning' ? runKey : used.get(d.key)}" />`);
for (const d of DO) slots.push(`<BitOutput${d.addr} PointIOKey="${used.get(d.key)}" />`);
for (const d of AI) slots.push(`<NumericInput${d.addr} PointIOKey="${used.get(d.key)}" />`);
for (const d of AO) slots.push(`<NumericOutput${d.addr} PointIOKey="${used.get(d.key)}" />`);
tail = tail.replace(/(<ModbusTCPClient>\s*)<PointIOCount[^>]*\/>(\s*<PointIOOffset[^>]*\/>)/, (_, a, b) =>
  `${a}<PointIOCount BitInputCount="${DI.length}" BitOutputCount="${DO.length}" FloatInputCount="0" FloatOutputCount="0" IntInputCount="0" IntOutputCount="0" NumericInputCount="${AI.length}" NumericOutputCount="${AO.length}" />` +
  `${b.replace(/\w+Offset="\d+"/g, (m) => m.replace(/"\d+"/, '"0"'))}${slots.map((s) => NL + '      ' + s).join('')}`);
tail = tail.replace(/(<ModbusTCPClient>[\s\S]*?<Properties )[^/]*\/>/, '$1ReadCoils="False" ReadHoldingRegisters="False" ScaleFactor="100" />');

const missing = [...DI, ...DO, ...AI, ...AO].filter((d) => d.key !== 'fioRunning' && !used.has(d.key)).map((d) => d.key);
if (missing.length) throw new Error('Señales sin pieza en la escena: ' + missing.join(', '));

const xml = '﻿' + head + objects.join(NL) + tail;
writeFileSync(OUT, xml);
console.log(`factoryio/SmartFactory_TapasBases_generada.factoryio generado: ${objects.length} objetos, ${used.size + 1} señales mapeadas`);

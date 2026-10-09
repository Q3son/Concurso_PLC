// =====================================================================
// Geometría única de la celda (metros, vista superior, x a la derecha, y hacia abajo).
// La usan: el gemelo digital (plant.js), el sinóptico 2D (view2d.js), la vista 3D (view3d.js)
// y el generador del plano (tools/generar-plano.mjs). Cambiar aquí = cambiar en todos.
// =====================================================================

export const BELT_SPEED = 0.6;     // m/s: velocidad máxima de una Belt Conveyor digital en Factory I/O
export const SORTER_SPEED = 1.5;   // m/s: Pop Up Wheel Sorter
export const BELT_WIDTH = 0.6;
export const PART_SIZE = 0.4;
export const PART_GAP = 0.5;       // separación mínima entre centros al acumularse

// Fajas (tramos rectos). out = salida digital del PLC que las mueve.
export const BELTS = Object.freeze({
  M1: { from: [-3.6, -1.1], to: [0.7, -1.1], out: 'M1', label: 'Faja alimentadora 1 (verde)' },
  M2: { from: [-3.6, 1.1],  to: [0.7, 1.1],  out: 'M2', label: 'Faja alimentadora 2 (azul)' },
  M3: { from: [0, 0],       to: [6.0, 0],    out: 'M3', label: 'Faja alimentadora principal' },
  M4: { from: [6.5, -0.5],  to: [6.5, -4.6], out: 'M4', label: 'Rama de tapas' },
  M5: { from: [6.5, 0.5],   to: [6.5, 4.6],  out: 'M5', label: 'Rama de bases' },
  M6: { from: [8.2, -5.0],  to: [15.0, -5.0], out: 'M6', label: 'Salida tapas (azules)' },
  M7: { from: [11.0, -4.4], to: [11.0, -1.6], out: 'M7', label: 'Salida tapas verdes' },
  M8: { from: [8.2, 5.0],   to: [15.0, 5.0], out: 'M8', label: 'Salida bases (azules)' },
  M9: { from: [11.0, 4.4],  to: [11.0, 1.6], out: 'M9', label: 'Salida bases verdes' },
});

export const beltLength = (b) => Math.hypot(b.to[0] - b.from[0], b.to[1] - b.from[1]);
export const beltDir = (b) => {
  const L = beltLength(b);
  return [(b.to[0] - b.from[0]) / L, (b.to[1] - b.from[1]) / L];
};
export const pointOn = (b, s) => {
  const [dx, dy] = beltDir(b);
  return [b.from[0] + dx * s, b.from[1] + dy * s];
};

// Wheel sorter: entra desde el final de M3; sale hacia M4 (izquierda/arriba) o M5 (derecha/abajo)
export const SORTER = Object.freeze({ center: [6.5, 0], size: 1.0, pathIn: 0.5, pathOut: 0.5 });

// Centros de mecanizado (Machining Center). entry = bahía de entrada (fin de la rama).
export const MACHINES = Object.freeze({
  MC1: { rect: [6.0, -7.1, 8.9, -5.45], entryBelt: 'M4', exitBelt: 'M6', lids: true,  label: 'MC1 Centro de mecanizado: tapas' },
  MC2: { rect: [6.0, 5.45, 8.9, 7.1],   entryBelt: 'M5', exitBelt: 'M8', lids: false, label: 'MC2 Centro de mecanizado: bases' },
});

// Pushers: empujan desde la faja "src" (posición s) hacia la faja "dst" (posición sDst).
// body = posición del cuerpo del cilindro; dir = sentido del empuje.
export const PUSHERS = Object.freeze({
  Y01: { src: 'M1', s: 3.95, dst: 'M3', sDst: 0.35, body: [0.35, -1.85], dir: [0, 1],  limits: ['LS1', 'LS2'], label: 'Y01 faja 1 → principal' },
  Y02: { src: 'M2', s: 3.95, dst: 'M3', sDst: 0.35, body: [0.35, 1.85],  dir: [0, -1], limits: ['LS3', 'LS4'], label: 'Y02 faja 2 → principal' },
  Y03: { src: 'M6', s: 2.8,  dst: 'M7', sDst: 0.25, body: [11.0, -5.8],  dir: [0, 1],  limits: ['LS5', 'LS6'], label: 'Y03 tapas verdes → M7' },
  Y04: { src: 'M8', s: 2.8,  dst: 'M9', sDst: 0.25, body: [11.0, 5.8],   dir: [0, -1], limits: ['LS7', 'LS8'], label: 'Y04 bases verdes → M9' },
});
export const PUSHER_REACH = 0.32;
export const PUSHER_STROKE_S = 0.5;   // s para recorrer la carrera completa

// Sensores de proceso. key = clave en snapshot.inputs. type: diffuse | vision | capacitive
// detects (solo visión): qué pieza reconoce, igual que la configuración de Factory I/O.
export const SENSORS = Object.freeze([
  { code: 'S2',   key: 'sFeed1Ready',  belt: 'M1', s: 3.95, type: 'diffuse',    label: 'Pieza verde lista frente a Y01' },
  { code: 'S4',   key: 'sFeed2Ready',  belt: 'M2', s: 3.95, type: 'diffuse',    label: 'Pieza azul lista frente a Y02' },
  { code: 'S5',   key: 'sMainDrop',    belt: 'M3', s: 0.35, type: 'diffuse',    label: 'Pieza cayó en la faja principal' },
  { code: 'S6.1', key: 'sGreenRaw',    belt: 'M3', s: 5.5,  type: 'vision', detects: { color: 'G', kind: 'raw' },  label: 'Visión: crudo verde' },
  { code: 'S6.2', key: 'sBlueRaw',     belt: 'M3', s: 5.5,  type: 'vision', detects: { color: 'B', kind: 'raw' },  label: 'Visión: crudo azul' },
  { code: 'S7',   key: 'sSorter',      belt: 'WS', s: 0.5,  type: 'diffuse',    label: 'Presencia en el wheel sorter' },
  { code: 'S8',   key: 'sLidsEntry',   belt: 'M4', s: 3.9,  type: 'diffuse',    label: 'Pieza en la entrada de MC1' },
  { code: 'S9',   key: 'sBasesEntry',  belt: 'M5', s: 3.9,  type: 'diffuse',    label: 'Pieza en la entrada de MC2' },
  { code: 'S10',  key: 'sGreenLid',    belt: 'M6', s: 2.8,  type: 'vision', detects: { color: 'G', kind: 'lid' },  label: 'Visión: tapa verde' },
  { code: 'S11',  key: 'sGreenBase',   belt: 'M8', s: 2.8,  type: 'vision', detects: { color: 'G', kind: 'base' }, label: 'Visión: base verde' },
  { code: 'S12',  key: 'sBlueLids',    belt: 'M6', s: 6.6,  type: 'capacitive', label: 'Contador tapas azules' },
  { code: 'S13',  key: 'sGreenLids',   belt: 'M7', s: 2.6,  type: 'capacitive', label: 'Contador tapas verdes' },
  { code: 'S14',  key: 'sBlueBases',   belt: 'M8', s: 6.6,  type: 'capacitive', label: 'Contador bases azules' },
  { code: 'S15',  key: 'sGreenBases',  belt: 'M9', s: 2.6,  type: 'capacitive', label: 'Contador bases verdes' },
]);
export const SENSOR_TOL = 0.22;

// Emisores (al inicio de las fajas alimentadoras) y removedores (al final de las salidas)
export const EMITTERS = Object.freeze({
  E1: { belt: 'M1', s: 0.4, color: 'G', label: 'Emisor crudo verde' },
  E2: { belt: 'M2', s: 0.4, color: 'B', label: 'Emisor crudo azul' },
});
export const REMOVERS = Object.freeze({
  R1: { belt: 'M6', exit: 'blueLids' },
  R2: { belt: 'M7', exit: 'greenLids' },
  R3: { belt: 'M8', exit: 'blueBases' },
  R4: { belt: 'M9', exit: 'greenBases' },
});

// Panel del operador y torre de luces
export const PANEL = Object.freeze({ at: [-3.0, 4.4], tower: [-1.6, 3.6] });

// Límites del dibujo
export const BOUNDS = Object.freeze({ minX: -4.4, minY: -7.6, maxX: 15.8, maxY: 7.6 });

// Zonas funcionales (para el plano y el sinóptico)
export const ZONES = Object.freeze([
  { id: 1, label: 'Zona 1 · Alimentación',          rect: [-4.2, -2.5, 1.2, 2.5],  labelAt: [-4.1, -2.2], anchor: 'start' },
  { id: 2, label: 'Zona 2 · Identificación',        rect: [4.85, -0.85, 7.25, 0.85], labelAt: [6.1, -1.0], anchor: 'end' },
  { id: 3, label: 'Zona 3 · Mecanizado',            rect: [5.6, -7.45, 9.3, 7.5],  labelAt: [5.7, 7.42], anchor: 'start' },
  { id: 4, label: 'Zona 4 · Segregación y conteo',  rect: [9.6, -6.75, 15.6, 6.6], labelAt: [9.7, -6.45], anchor: 'start' },
]);

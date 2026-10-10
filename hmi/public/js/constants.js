// Constantes compartidas por el navegador, el servidor y las pruebas.
// Deben coincidir con los tipos de CODESYS (plc/codesys/01_DUT) y con GVL_Alarm.

export const STATE = Object.freeze({
  IDLE: 0, AUTO_RUN: 10, AUTO_STOP: 20, MANUAL: 30, FAULT: 90, EMERGENCY: 99,
});

export const STATE_INFO = Object.freeze({
  0:  { label: 'Detenida, lista para arrancar',              short: 'Lista',      tone: 'idle' },
  10: { label: 'Produciendo',                                short: 'En marcha',  tone: 'run' },
  20: { label: 'Parada controlada: terminando lo que está en proceso', short: 'Vaciando', tone: 'run' },
  30: { label: 'Operación manual',                           short: 'Manual',     tone: 'manual' },
  90: { label: 'Falla: revisa alarmas y pulsa Reset',        short: 'Falla',      tone: 'alarm' },
  99: { label: 'Paro de emergencia activo',                  short: 'Emergencia', tone: 'alarm' },
});

export const PUSHER_STEP = Object.freeze({ IDLE: 0, EXTEND: 10, RETRACT: 20, DONE: 30, ERROR: 90 });
export const SORTER_STEP = Object.freeze({ IDLE: 0, PREPARE: 10, TRANSFER: 20, DONE: 30, ERROR: 90 });
export const SORTER_STEP_NAME = Object.freeze({ 0: 'Libre', 10: 'Orientando ruedas', 20: 'Transfiriendo', 30: 'Entregada', 90: 'Error' });

// E_Color: S6.1 identifica crudo verde (1) y S6.2 crudo azul (2)
export const COLOR = Object.freeze({ NONE: 0, GREEN: 1, BLUE: 2 });
export const COLOR_NAME = Object.freeze({ 0: '—', 1: 'verde', 2: 'azul' });

// E_Branch: también es el índice de línea (1 tapas, 2 bases)
export const BRANCH = Object.freeze({ NONE: 0, LIDS: 1, BASES: 2 });
export const BRANCH_NAME = Object.freeze({ 0: '—', 1: 'tapas', 2: 'bases' });

// Salidas de producto terminado (mismo orden que FB_Kpi.axExit[1..4])
export const EXITS = Object.freeze([
  { key: 'blueLids',   sensor: 'S12', label: 'Tapas azules',  color: COLOR.BLUE,  kind: 'lid' },
  { key: 'greenLids',  sensor: 'S13', label: 'Tapas verdes',  color: COLOR.GREEN, kind: 'lid' },
  { key: 'blueBases',  sensor: 'S14', label: 'Bases azules',  color: COLOR.BLUE,  kind: 'base' },
  { key: 'greenBases', sensor: 'S15', label: 'Bases verdes',  color: COLOR.GREEN, kind: 'base' },
]);

// Mismo orden e ID que GVL_Alarm.aAlarm[1..24] (textos en PLC_PRG, sección 0)
export const ALARMS = Object.freeze([
  { id: 1,  kind: 'emergency', text: 'Paro de emergencia activado',                       help: 'Libera la seta de emergencia y pulsa Reset.' },
  { id: 2,  kind: 'fault',     text: 'Y01 (faja verde) no llegó al final delantero',       help: 'Revisa obstrucciones entre M1 y M3 o el sensor LS1.' },
  { id: 3,  kind: 'fault',     text: 'Y01 (faja verde) no regresó a su posición',          help: 'Revisa el sensor LS2.' },
  { id: 4,  kind: 'fault',     text: 'Y02 (faja azul) no llegó al final delantero',        help: 'Revisa obstrucciones entre M2 y M3 o el sensor LS3.' },
  { id: 5,  kind: 'fault',     text: 'Y02 (faja azul) no regresó a su posición',           help: 'Revisa el sensor LS4.' },
  { id: 6,  kind: 'fault',     text: 'Y03 (tapas verdes) no llegó al final delantero',     help: 'Revisa obstrucciones entre M6 y M7 o el sensor LS5.' },
  { id: 7,  kind: 'fault',     text: 'Y03 (tapas verdes) no regresó a su posición',        help: 'Revisa el sensor LS6.' },
  { id: 8,  kind: 'fault',     text: 'Y04 (bases verdes) no llegó al final delantero',     help: 'Revisa obstrucciones entre M8 y M9 o el sensor LS7.' },
  { id: 9,  kind: 'fault',     text: 'Y04 (bases verdes) no regresó a su posición',        help: 'Revisa el sensor LS8.' },
  { id: 10, kind: 'fault',     text: 'Transferencia a la faja principal no confirmada (S5)', help: 'La pieza no cayó en M3. Retírala de la zona de empuje y pulsa Reset.' },
  { id: 11, kind: 'fault',     text: 'Pieza no identificada en el wheel sorter',            help: 'Llegó una pieza que no es crudo verde ni azul. Retírala de WS1 y pulsa Reset.' },
  { id: 12, kind: 'fault',     text: 'Wheel sorter: la pieza no terminó de pasar',          help: 'Revisa S7 y que la rama destino no esté bloqueada.' },
  { id: 13, kind: 'fault',     text: 'MC1 (tapas) reporta error',                           help: 'Pieza inválida en la bahía de entrada de MC1. Retírala y pulsa Reset.' },
  { id: 14, kind: 'fault',     text: 'MC2 (bases) reporta error',                           help: 'Pieza inválida en la bahía de entrada de MC2. Retírala y pulsa Reset.' },
  { id: 15, kind: 'fault',     text: 'MC1 (tapas): puerta abierta durante el mecanizado',   help: 'La puerta se abrió con una pieza en proceso. Ciérrala y pulsa Reset.' },
  { id: 16, kind: 'fault',     text: 'MC2 (bases): puerta abierta durante el mecanizado',   help: 'La puerta se abrió con una pieza en proceso. Ciérrala y pulsa Reset.' },
  { id: 17, kind: 'fault',     text: 'Atasco en la salida de tapas azules (S12)',           help: 'Retira el producto detenido al final de M6.' },
  { id: 18, kind: 'fault',     text: 'Atasco en la salida de tapas verdes (S13)',           help: 'Retira el producto detenido al final de M7.' },
  { id: 19, kind: 'fault',     text: 'Atasco en la salida de bases azules (S14)',           help: 'Retira el producto detenido al final de M8.' },
  { id: 20, kind: 'fault',     text: 'Atasco en la salida de bases verdes (S15)',           help: 'Retira el producto detenido al final de M9.' },
  { id: 21, kind: 'fault',     text: 'Arranque bloqueado: pusher fuera de posición',        help: 'Verifica los finales de carrera traseros (LS2, LS4, LS6, LS8) y pulsa Reset.' },
  { id: 22, kind: 'warning',   text: 'Faja principal esperando cupo en una rama',           help: 'Cuello de botella en un centro de mecanizado. Revisa MC1/MC2.' },
  { id: 23, kind: 'warning',   text: 'Cola de seguimiento llena',                           help: 'Demasiadas piezas en una rama; revisa iBranchCapacity.' },
  { id: 24, kind: 'warning',   text: 'Factory I/O detenido o sin comunicación',             help: 'Pulsa Play en Factory I/O y revisa el driver Modbus.' },
  { id: 25, kind: 'warning',   text: 'Piezas perdidas en M3 o en una rama (seguimiento corregido)', help: 'Una pieza cayó o no llegó a la visión S6.1/S6.2. Revisa la posición de los sensores y del sorter.' },
]);

export const colorFromSensors = (green, blue) =>
  green && !blue ? COLOR.GREEN : blue && !green ? COLOR.BLUE : COLOR.NONE;

// Desempaqueta wLidsQueue / wBasesQueue (2 bits por pieza)
export const unpackQueue = (word, count) => {
  const out = [];
  for (let k = 0; k < Math.min(count, 8); k++) out.push((word >>> (2 * k)) & 3);
  return out;
};

export const maskHas = (mask, id) => ((mask >>> (id - 1)) & 1) === 1;

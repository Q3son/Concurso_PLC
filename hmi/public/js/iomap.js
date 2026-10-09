// =====================================================================
// Mapa de E/S único: Factory I/O <-> Modbus TCP <-> GVL_IO (CODESYS) <-> tablero.
// Lo usan: el panel de señales del tablero, el cliente OPC UA (src/tags.js),
// la verificación automática (tools/check-io.mjs) y la tabla de docs/02-mapa-io.md.
// addr = dirección Modbus (Coil / Discrete Input / Holding / Input Register).
// =====================================================================

// Entradas digitales del PLC = sensores de Factory I/O (Coils 0..33)
export const DI = Object.freeze([
  { addr: 0,  key: 'fioRunning',  code: '—',    plc: 'xFio_Running',    fio: 'FACTORY I/O (Running)',                label: 'Factory I/O en ejecución' },
  { addr: 1,  key: 'btnStart',    code: 'PB1',  plc: 'xBtn_Start',      fio: 'Start Button',                         label: 'Botón Start (NA)' },
  { addr: 2,  key: 'btnStop',     code: 'PB2',  plc: 'xBtn_Stop',       fio: 'Stop Button',                          label: 'Botón Stop (NC)' },
  { addr: 3,  key: 'btnReset',    code: 'PB3',  plc: 'xBtn_Reset',      fio: 'Reset Button',                         label: 'Botón Reset (NA)' },
  { addr: 4,  key: 'btnEStop',    code: 'ES1',  plc: 'xBtn_EStop',      fio: 'Emergency Stop',                       label: 'Paro de emergencia (NC)' },
  { addr: 5,  key: 'selAuto',     code: 'SW1',  plc: 'xSel_Auto',       fio: 'Selector Switch (Auto)',               label: 'Selector en Auto' },
  { addr: 6,  key: 'sFeed1Ready', code: 'S2',   plc: 'xS2_Feed1Ready',  fio: 'Diffuse Sensor (fin de M1)',           label: 'Pieza verde lista frente a Y01', zone: 1 },
  { addr: 7,  key: 'y01Front',    code: 'LS1',  plc: 'xY01_Front',      fio: 'Pusher Y01 (Front Limit)',             label: 'Y01 adelante', zone: 1 },
  { addr: 8,  key: 'y01Back',     code: 'LS2',  plc: 'xY01_Back',       fio: 'Pusher Y01 (Back Limit)',              label: 'Y01 atrás', zone: 1 },
  { addr: 9,  key: 'sFeed2Ready', code: 'S4',   plc: 'xS4_Feed2Ready',  fio: 'Diffuse Sensor (fin de M2)',           label: 'Pieza azul lista frente a Y02', zone: 1 },
  { addr: 10, key: 'y02Front',    code: 'LS3',  plc: 'xY02_Front',      fio: 'Pusher Y02 (Front Limit)',             label: 'Y02 adelante', zone: 1 },
  { addr: 11, key: 'y02Back',     code: 'LS4',  plc: 'xY02_Back',       fio: 'Pusher Y02 (Back Limit)',              label: 'Y02 atrás', zone: 1 },
  { addr: 12, key: 'sMainDrop',   code: 'S5',   plc: 'xS5_MainDrop',    fio: 'Diffuse Sensor (inicio de M3)',        label: 'Pieza cayó en la faja principal', zone: 1 },
  { addr: 13, key: 'sGreenRaw',   code: 'S6.1', plc: 'xS61_GreenRaw',   fio: 'Vision Sensor (Green Raw Material)',   label: 'Visión: crudo verde', zone: 2 },
  { addr: 14, key: 'sBlueRaw',    code: 'S6.2', plc: 'xS62_BlueRaw',    fio: 'Vision Sensor (Blue Raw Material)',    label: 'Visión: crudo azul', zone: 2 },
  { addr: 15, key: 'sSorter',     code: 'S7',   plc: 'xS7_Sorter',      fio: 'Diffuse Sensor (wheel sorter)',        label: 'Presencia en el wheel sorter', zone: 2 },
  { addr: 16, key: 'sLidsEntry',  code: 'S8',   plc: 'xS8_LidsEntry',   fio: 'Diffuse Sensor (entrada MC1)',         label: 'Pieza en la entrada de MC1', zone: 3 },
  { addr: 17, key: 'sBasesEntry', code: 'S9',   plc: 'xS9_BasesEntry',  fio: 'Diffuse Sensor (entrada MC2)',         label: 'Pieza en la entrada de MC2', zone: 3 },
  { addr: 18, key: 'mc1Busy',     code: 'MC1',  plc: 'xMC1_Busy',       fio: 'Machining Center 1 (Is Busy)',         label: 'MC1 ocupada', zone: 3 },
  { addr: 19, key: 'mc1Error',    code: 'MC1',  plc: 'xMC1_Error',      fio: 'Machining Center 1 (Has Error)',       label: 'MC1 con error', zone: 3 },
  { addr: 20, key: 'mc1Opened',   code: 'MC1',  plc: 'xMC1_Opened',     fio: 'Machining Center 1 (Opened)',          label: 'MC1 puerta abierta', zone: 3 },
  { addr: 21, key: 'mc2Busy',     code: 'MC2',  plc: 'xMC2_Busy',       fio: 'Machining Center 2 (Is Busy)',         label: 'MC2 ocupada', zone: 3 },
  { addr: 22, key: 'mc2Error',    code: 'MC2',  plc: 'xMC2_Error',      fio: 'Machining Center 2 (Has Error)',       label: 'MC2 con error', zone: 3 },
  { addr: 23, key: 'mc2Opened',   code: 'MC2',  plc: 'xMC2_Opened',     fio: 'Machining Center 2 (Opened)',          label: 'MC2 puerta abierta', zone: 3 },
  { addr: 24, key: 'sGreenLid',   code: 'S10',  plc: 'xS10_GreenLid',   fio: 'Vision Sensor (Green Product Lid)',    label: 'Visión: tapa verde', zone: 4 },
  { addr: 25, key: 'y03Front',    code: 'LS5',  plc: 'xY03_Front',      fio: 'Pusher Y03 (Front Limit)',             label: 'Y03 adelante', zone: 4 },
  { addr: 26, key: 'y03Back',     code: 'LS6',  plc: 'xY03_Back',       fio: 'Pusher Y03 (Back Limit)',              label: 'Y03 atrás', zone: 4 },
  { addr: 27, key: 'sGreenBase',  code: 'S11',  plc: 'xS11_GreenBase',  fio: 'Vision Sensor (Green Product Base)',   label: 'Visión: base verde', zone: 4 },
  { addr: 28, key: 'y04Front',    code: 'LS7',  plc: 'xY04_Front',      fio: 'Pusher Y04 (Front Limit)',             label: 'Y04 adelante', zone: 4 },
  { addr: 29, key: 'y04Back',     code: 'LS8',  plc: 'xY04_Back',       fio: 'Pusher Y04 (Back Limit)',              label: 'Y04 atrás', zone: 4 },
  { addr: 30, key: 'sBlueLids',   code: 'S12',  plc: 'xS12_BlueLids',   fio: 'Capacitive Sensor (fin de M6)',        label: 'Cuenta tapas azules', zone: 4 },
  { addr: 31, key: 'sGreenLids',  code: 'S13',  plc: 'xS13_GreenLids',  fio: 'Capacitive Sensor (fin de M7)',        label: 'Cuenta tapas verdes', zone: 4 },
  { addr: 32, key: 'sBlueBases',  code: 'S14',  plc: 'xS14_BlueBases',  fio: 'Capacitive Sensor (fin de M8)',        label: 'Cuenta bases azules', zone: 4 },
  { addr: 33, key: 'sGreenBases', code: 'S15',  plc: 'xS15_GreenBases', fio: 'Capacitive Sensor (fin de M9)',        label: 'Cuenta bases verdes', zone: 4 },
]);

// Entradas de registro (Holding Registers 0..1)
export const AI = Object.freeze([
  { addr: 0, key: 'mc1Progress', code: 'MC1', plc: 'iMC1_Progress', fio: 'Machining Center 1 (Progress)', label: 'Avance MC1 %' },
  { addr: 1, key: 'mc2Progress', code: 'MC2', plc: 'iMC2_Progress', fio: 'Machining Center 2 (Progress)', label: 'Avance MC2 %' },
]);

// Salidas digitales del PLC = actuadores de Factory I/O (Discrete Inputs 0..31)
export const DO = Object.freeze([
  { addr: 0,  key: 'e1',         code: 'E1',   plc: 'xE1_EmitGreen',    fio: 'Emitter 1 (Emit)',                      label: 'Emisor crudo verde', zone: 1 },
  { addr: 1,  key: 'e2',         code: 'E2',   plc: 'xE2_EmitBlue',     fio: 'Emitter 2 (Emit)',                      label: 'Emisor crudo azul', zone: 1 },
  { addr: 2,  key: 'm1',         code: 'M1',   plc: 'xM1_Feed1',        fio: 'Belt Conveyor (faja 1)',                label: 'Faja alimentadora 1', zone: 1 },
  { addr: 3,  key: 'm2',         code: 'M2',   plc: 'xM2_Feed2',        fio: 'Belt Conveyor (faja 2)',                label: 'Faja alimentadora 2', zone: 1 },
  { addr: 4,  key: 'y01',        code: 'Y01',  plc: 'xY01_Push',        fio: 'Pusher Y01',                            label: 'Pusher faja 1 → principal', zone: 1 },
  { addr: 5,  key: 'y02',        code: 'Y02',  plc: 'xY02_Push',        fio: 'Pusher Y02',                            label: 'Pusher faja 2 → principal', zone: 1 },
  { addr: 6,  key: 'm3',         code: 'M3',   plc: 'xM3_Main',         fio: 'Belt Conveyor (principal)',             label: 'Faja alimentadora principal', zone: 1 },
  { addr: 7,  key: 'wsPlus',     code: 'WS1+', plc: 'xWS_Plus',         fio: 'Pop Up Wheel Sorter 1 (+)',             label: 'Wheel sorter: ruedas arriba', zone: 2 },
  { addr: 8,  key: 'wsLeft',     code: 'WS1L', plc: 'xWS_Left',         fio: 'Pop Up Wheel Sorter 1 (Left)',          label: 'Wheel sorter: izquierda (tapas)', zone: 2 },
  { addr: 9,  key: 'wsRight',    code: 'WS1R', plc: 'xWS_Right',        fio: 'Pop Up Wheel Sorter 1 (Right)',         label: 'Wheel sorter: derecha (bases)', zone: 2 },
  { addr: 10, key: 'm4',         code: 'M4',   plc: 'xM4_LidsBranch',   fio: 'Belt Conveyor (rama tapas)',            label: 'Rama de tapas', zone: 3 },
  { addr: 11, key: 'm5',         code: 'M5',   plc: 'xM5_BasesBranch',  fio: 'Belt Conveyor (rama bases)',            label: 'Rama de bases', zone: 3 },
  { addr: 12, key: 'mc1Start',   code: 'MC1',  plc: 'xMC1_Start',       fio: 'Machining Center 1 (Start)',            label: 'MC1 Start', zone: 3 },
  { addr: 13, key: 'mc1Stop',    code: 'MC1',  plc: 'xMC1_Stop',        fio: 'Machining Center 1 (Stop)',             label: 'MC1 Stop', zone: 3 },
  { addr: 14, key: 'mc1Reset',   code: 'MC1',  plc: 'xMC1_Reset',       fio: 'Machining Center 1 (Reset)',            label: 'MC1 Reset', zone: 3 },
  { addr: 15, key: 'mc1Lids',    code: 'MC1',  plc: 'xMC1_ProduceLids', fio: 'Machining Center 1 (Produce Lids)',     label: 'MC1 produce tapas', zone: 3 },
  { addr: 16, key: 'mc2Start',   code: 'MC2',  plc: 'xMC2_Start',       fio: 'Machining Center 2 (Start)',            label: 'MC2 Start', zone: 3 },
  { addr: 17, key: 'mc2Stop',    code: 'MC2',  plc: 'xMC2_Stop',        fio: 'Machining Center 2 (Stop)',             label: 'MC2 Stop', zone: 3 },
  { addr: 18, key: 'mc2Reset',   code: 'MC2',  plc: 'xMC2_Reset',       fio: 'Machining Center 2 (Reset)',            label: 'MC2 Reset', zone: 3 },
  { addr: 19, key: 'mc2Lids',    code: 'MC2',  plc: 'xMC2_ProduceLids', fio: 'Machining Center 2 (Produce Lids)',     label: 'MC2 produce tapas (FALSE = bases)', zone: 3 },
  { addr: 20, key: 'm6',         code: 'M6',   plc: 'xM6_LidsOut',      fio: 'Belt Conveyor (salida tapas)',          label: 'Salida de tapas (azules)', zone: 4 },
  { addr: 21, key: 'y03',        code: 'Y03',  plc: 'xY03_Push',        fio: 'Pusher Y03',                            label: 'Pusher tapas verdes', zone: 4 },
  { addr: 22, key: 'm7',         code: 'M7',   plc: 'xM7_GreenLids',    fio: 'Belt Conveyor (tapas verdes)',          label: 'Salida tapas verdes', zone: 4 },
  { addr: 23, key: 'm8',         code: 'M8',   plc: 'xM8_BasesOut',     fio: 'Belt Conveyor (salida bases)',          label: 'Salida de bases (azules)', zone: 4 },
  { addr: 24, key: 'y04',        code: 'Y04',  plc: 'xY04_Push',        fio: 'Pusher Y04',                            label: 'Pusher bases verdes', zone: 4 },
  { addr: 25, key: 'm9',         code: 'M9',   plc: 'xM9_GreenBases',   fio: 'Belt Conveyor (bases verdes)',          label: 'Salida bases verdes', zone: 4 },
  { addr: 26, key: 'lampGreen',  code: 'H1',   plc: 'xLamp_Green',      fio: 'Stack Light (Green)',                   label: 'Torre: verde' },
  { addr: 27, key: 'lampYellow', code: 'H2',   plc: 'xLamp_Yellow',     fio: 'Stack Light (Yellow)',                  label: 'Torre: amarilla' },
  { addr: 28, key: 'lampRed',    code: 'H3',   plc: 'xLamp_Red',        fio: 'Stack Light (Red)',                     label: 'Torre: roja' },
  { addr: 29, key: 'lampStart',  code: 'H4',   plc: 'xLamp_Start',      fio: 'Start Button (Light)',                  label: 'Luz botón Start' },
  { addr: 30, key: 'lampReset',  code: 'H5',   plc: 'xLamp_Reset',      fio: 'Reset Button (Light)',                  label: 'Luz botón Reset' },
  { addr: 31, key: 'lampStop',   code: 'H6',   plc: 'xLamp_Stop',       fio: 'Stop Button (Light)',                   label: 'Luz botón Stop' },
]);

// Salidas de registro (Input Registers 0)
export const AO = Object.freeze([
  { addr: 0, key: 'display', code: 'D1', plc: 'iDisplay', fio: 'Digital Display', label: 'Display: productos terminados' },
]);

// Direcciones IEC que CODESYS asigna al "ModbusTCP Server Device" (pestaña Asignación E/S).
// GVL_IO las usa con AT %... ; si CODESYS cambia el inicio (p. ej. al agregar otro dispositivo), se ajusta aquí y en GVL_IO.
export const PLC_BASE = Object.freeze({ coilsByte: 4, discreteInputsByte: 4, holdingWord: 0, inputRegWord: 0 });
export function plcAddress(kind, addr) {
  if (kind === 'DI') return `%IX${PLC_BASE.coilsByte + Math.floor(addr / 8)}.${addr % 8}`;
  if (kind === 'DO') return `%QX${PLC_BASE.discreteInputsByte + Math.floor(addr / 8)}.${addr % 8}`;
  if (kind === 'AI') return `%IW${PLC_BASE.holdingWord + addr}`;
  return `%QW${PLC_BASE.inputRegWord + addr}`;
}

export const IO_SUMMARY = Object.freeze({
  di: DI.length, ai: AI.length, do: DO.length, ao: AO.length,
  processSensors: DI.filter((d) => d.zone).length,
  processActuators: DO.filter((d) => d.zone).length,
});

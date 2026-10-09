// Mapa de variables del PLC (rutas relativas a la Application de CODESYS)
// -> claves del "snapshot" normalizado que consume el tablero (el mismo que produce el simulador).
// Las E/S salen de public/js/iomap.js: un solo lugar para el mapa de señales.
import { DI, AI, DO, AO } from '../public/js/iomap.js';

const io = (group, list) => list.map((d) => [`${group}.${d.key}`, `GVL_IO.${d.plc}`]);

export const READ_TAGS = [
  ...io('inputs', DI), ...io('inputs', AI), ...io('outputs', DO), ...io('outputs', AO),
  // Estado
  ['state', 'GVL_HMI.iState'],
  ['modeAuto', 'GVL_HMI.xModeAuto'],
  ['turnBlue', 'GVL_HMI.xTurnBlue'],
  ['sorterStep', 'GVL_HMI.iSorterStep'],
  ['sorterNext', 'GVL_HMI.iSorterNext'],
  ['lastColor', 'GVL_HMI.iLastColor'],
  ['nextGreenToBases', 'GVL_HMI.xNextGreenToBases'],
  ['nextBlueToBases', 'GVL_HMI.xNextBlueToBases'],
  ['onMain', 'GVL_HMI.iOnMain'],
  ['lidsQueue', 'GVL_HMI.iLidsQueue'],
  ['basesQueue', 'GVL_HMI.iBasesQueue'],
  ['lidsQueueWord', 'GVL_HMI.wLidsQueue'],
  ['basesQueueWord', 'GVL_HMI.wBasesQueue'],
  ['mc1Color', 'GVL_HMI.iMC1Color'],
  ['mc2Color', 'GVL_HMI.iMC2Color'],
  ['onLidsOut', 'GVL_HMI.iOnLidsOut'],
  ['onGreenLids', 'GVL_HMI.iOnGreenLids'],
  ['onBasesOut', 'GVL_HMI.iOnBasesOut'],
  ['onGreenBases', 'GVL_HMI.iOnGreenBases'],
  ['pusherStep.y01', 'GVL_HMI.iY01Step'],
  ['pusherStep.y02', 'GVL_HMI.iY02Step'],
  ['pusherStep.y03', 'GVL_HMI.iY03Step'],
  ['pusherStep.y04', 'GVL_HMI.iY04Step'],
  ['lot.mode', 'GVL_HMI.xLotMode'],
  ['lot.completed', 'GVL_HMI.xLotCompleted'],
  ['lot.green', 'GVL_Param.uiLotGreen'],
  ['lot.blue', 'GVL_Param.uiLotBlue'],
  ['lot.fedGreen', 'GVL_HMI.udiLotFedGreen'],
  ['lot.fedBlue', 'GVL_HMI.udiLotFedBlue'],
  ['alarms.active', 'GVL_HMI.dwAlarmActive'],
  ['alarms.unack', 'GVL_HMI.dwAlarmUnack'],
  ['heartbeat', 'GVL_HMI.udiHeartbeat'],
  // Mandos mantenidos (para pintar el estado de los botones)
  ['hmi.estop', 'GVL_HMI.xCmdEStop'],
  ...['E1', 'E2', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'WSPlus', 'WSLeft', 'WSRight', 'MC1', 'MC2']
    .map((n) => [`hmi.man${n}`, `GVL_HMI.xMan${n}`]),
  // KPI
  ['kpi.total', 'GVL_HMI.udiTotal'],
  ['kpi.blueLids', 'GVL_HMI.udiBlueLids'],
  ['kpi.greenLids', 'GVL_HMI.udiGreenLids'],
  ['kpi.blueBases', 'GVL_HMI.udiBlueBases'],
  ['kpi.greenBases', 'GVL_HMI.udiGreenBases'],
  ['kpi.fedGreen', 'GVL_HMI.udiFedGreen'],
  ['kpi.fedBlue', 'GVL_HMI.udiFedBlue'],
  ['kpi.ppm', 'GVL_HMI.rPPM'],
  ['kpi.ppmInst', 'GVL_HMI.rPPMInst'],
  ['kpi.cycle', 'GVL_HMI.rCycleTime_s'],
  ['kpi.availability', 'GVL_HMI.rAvailability'],
  ['kpi.utilMC1', 'GVL_HMI.rUtilMC1'],
  ['kpi.utilMC2', 'GVL_HMI.rUtilMC2'],
  ['kpi.cycleMC1', 'GVL_HMI.rCycleMC1_s'],
  ['kpi.cycleMC2', 'GVL_HMI.rCycleMC2_s'],
  ['kpi.runTime', 'GVL_HMI.udiRunTime_s'],
  ['kpi.faultTime', 'GVL_HMI.udiFaultTime_s'],
];

// Comandos que acepta el tablero. pulse = el PLC lo devuelve a FALSE solo (handshake).
export const COMMANDS = {
  start: { path: 'GVL_HMI.xCmdStart', pulse: true },
  stop: { path: 'GVL_HMI.xCmdStop', pulse: true },
  reset: { path: 'GVL_HMI.xCmdReset', pulse: true },
  modeAuto: { path: 'GVL_HMI.xCmdModeAuto', pulse: true },
  modeManual: { path: 'GVL_HMI.xCmdModeManual', pulse: true },
  clearTracking: { path: 'GVL_HMI.xCmdClearTracking', pulse: true },
  resetCounters: { path: 'GVL_HMI.xCmdResetCounters', pulse: true },
  manPushY01: { path: 'GVL_HMI.xManPushY01', pulse: true },
  manPushY02: { path: 'GVL_HMI.xManPushY02', pulse: true },
  manPushY03: { path: 'GVL_HMI.xManPushY03', pulse: true },
  manPushY04: { path: 'GVL_HMI.xManPushY04', pulse: true },
  estop: { path: 'GVL_HMI.xCmdEStop' },
  ...Object.fromEntries(['E1', 'E2', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'WSPlus', 'WSLeft', 'WSRight', 'MC1', 'MC2']
    .map((n) => [`man${n}`, { path: `GVL_HMI.xMan${n}` }])),
  // Lote: escribe las dos cantidades y luego pulsa xCmdApplyLot
  setLot: { lot: true, green: 'GVL_HMI.uiSetLotGreen', blue: 'GVL_HMI.uiSetLotBlue', apply: 'GVL_HMI.xCmdApplyLot' },
};

export function setPath(obj, key, value) {
  const parts = key.split('.');
  let o = obj;
  for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]] ??= {};
  o[parts.at(-1)] = value;
}

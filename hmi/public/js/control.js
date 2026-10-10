// =====================================================================
// Controller: espejo 1:1 de la lógica del PLC (plc/codesys) en JavaScript.
// Mismos bloques (FB_*), mismas secciones y el mismo orden de ejecución que PLC_PRG.st.
// Lo usan el gemelo digital (demo y pruebas automáticas) y el PLC simulado por OPC UA.
// Si cambias la lógica en CODESYS, cambia también este archivo (y las pruebas lo verificarán).
// Tiempos en segundos.
// =====================================================================
import { STATE, PUSHER_STEP, SORTER_STEP, COLOR, BRANCH, ALARMS, colorFromSensors } from './constants.js';

// ---------------------------------------------------------------------
// Parámetros (GVL_Param)
// ---------------------------------------------------------------------
export const DEFAULT_PARAM = Object.freeze({
  ALARM_COUNT: 25, FIFO_SIZE: 16, N_FEEDERS: 2, N_LINES: 2, STOP_IS_NC: true, ESTOP_IS_NC: true,
  tPusherTimeout: 3.0, tTransferTimeout: 4.0, tFeederCenter: 0.5, tDiverterCenter: 0.3,
  tMergeGap: 1.5, tSorterSettle: 0.3, tSorterTimeout: 10.0, tSorterEnter: 2.0, tSorterDeliver: 4.0, tSorterWait: 30.0, tMainLost: 20.0, tBayWait: 25.0, tJam: 5.0,
  tDrainTimeout: 90.0, tRunOn: 2.0, iMainCapacity: 3, iWipMax: 6, iBranchCapacity: 2,
  xLidsOnLeft: true, xHoldOutOnPush: true, uiLotGreen: 0, uiLotBlue: 0,
});

// ---------------------------------------------------------------------
// Bloques estándar IEC 61131-3
// ---------------------------------------------------------------------
export class TON {
  constructor() { this.ET = 0; this.Q = false; }
  call(IN, PT, dt) {
    this.ET = IN ? Math.min(this.ET + dt, PT) : 0;
    this.Q = IN && this.ET >= PT;
    return this.Q;
  }
}
export class TOF {
  constructor() { this.ET = 0; this.Q = false; }
  call(IN, PT, dt) {
    if (IN) { this.ET = 0; this.Q = true; } else if (this.Q) { this.ET += dt; if (this.ET >= PT) this.Q = false; }
    return this.Q;
  }
}
export class TP {
  constructor() { this.ET = 0; this.Q = false; this.prev = false; }
  call(IN, PT, dt) {
    if (!this.Q && IN && !this.prev) { this.Q = true; this.ET = 0; }
    if (this.Q) { this.ET += dt; if (this.ET >= PT) this.Q = false; }
    this.prev = IN;
    return this.Q;
  }
}
export class R_TRIG {
  constructor() { this.M = false; this.Q = false; }
  call(CLK) { this.Q = CLK && !this.M; this.M = CLK; return this.Q; }
}
export class F_TRIG {
  constructor() { this.M = false; this.Q = false; }
  call(CLK) { this.Q = !CLK && this.M; this.M = CLK; return this.Q; }
}

// ---------------------------------------------------------------------
// Funciones (03_FUN)
// ---------------------------------------------------------------------
export class Fifo {
  constructor(size = 16) { this.size = size; this.items = []; }
  get iCount() { return this.items.length; }
  push(c) { if (this.items.length >= this.size) return false; this.items.push(c); return true; }
  pop() { return this.items.length ? this.items.shift() : COLOR.NONE; }
  clear() { this.items = []; return true; }
  pack() { let w = 0; this.items.slice(0, 8).forEach((c, k) => { w |= (c & 3) << (2 * k); }); return w >>> 0; }
}

// ---------------------------------------------------------------------
// FB_Pusher
// ---------------------------------------------------------------------
export class FB_Pusher {
  constructor() {
    this.rtStart = new R_TRIG(); this.tonWatch = new TON();
    this.eStep = PUSHER_STEP.IDLE; this.eStepPrev = PUSHER_STEP.IDLE;
    this.xPush = false; this.xBusy = false; this.xDone = false; this.xHome = false;
    this.xErrExtend = false; this.xErrRetract = false; this.udiCycles = 0;
  }
  call({ xEnable, xStart, xFrontLimit, xBackLimit, tTimeout, xReset }, dt) {
    const S = PUSHER_STEP;
    this.rtStart.call(xStart);
    this.xDone = false;
    const moving = this.eStep === S.EXTEND || this.eStep === S.RETRACT;
    this.tonWatch.call(this.eStep === this.eStepPrev && moving, tTimeout, dt);
    this.eStepPrev = this.eStep;
    if (!xEnable && moving) this.eStep = S.IDLE;
    switch (this.eStep) {
      case S.IDLE:
        this.xPush = false;
        if (this.rtStart.Q && xEnable) this.eStep = S.EXTEND;
        break;
      case S.EXTEND:
        this.xPush = true;
        if (xFrontLimit) this.eStep = S.RETRACT;
        else if (this.tonWatch.Q) { this.xErrExtend = true; this.eStep = S.ERROR; }
        break;
      case S.RETRACT:
        this.xPush = false;
        if (xBackLimit) this.eStep = S.DONE;
        else if (this.tonWatch.Q) { this.xErrRetract = true; this.eStep = S.ERROR; }
        break;
      case S.DONE:
        this.xPush = false; this.xDone = true; this.udiCycles++; this.eStep = S.IDLE;
        break;
      case S.ERROR:
        this.xPush = false;
        if (xReset) { this.xErrExtend = false; this.xErrRetract = false; this.eStep = S.IDLE; }
        break;
    }
    this.xBusy = this.eStep === S.EXTEND || this.eStep === S.RETRACT;
    this.xHome = this.eStep === S.IDLE && xBackLimit && !this.xPush;
  }
}

// ---------------------------------------------------------------------
// FB_Conveyor
// ---------------------------------------------------------------------
export class FB_Conveyor {
  constructor() { this.tofRunOn = new TOF(); this.xMotor = false; this.runTime = 0; }
  call({ xEnable, xManualMode, xAutoMode, xDemand, xHold, xManualRun, tRunOn }, dt) {
    this.tofRunOn.call(xDemand, tRunOn, dt);
    if (!xEnable) this.xMotor = false;
    else if (xManualMode) this.xMotor = !!xManualRun;
    else this.xMotor = xAutoMode && !xHold && this.tofRunOn.Q;
    if (this.xMotor) this.runTime += dt;
  }
}

// ---------------------------------------------------------------------
// FB_FeederStation
// ---------------------------------------------------------------------
export class FB_FeederStation {
  constructor() {
    this.tonCenter = new TON(); this.fbPusher = new FB_Pusher(); this.eStepPrev = PUSHER_STEP.IDLE;
    this.xBelt = false; this.xPush = false; this.xReady = false; this.xPushStart = false;
    this.xBusy = false; this.xHome = false; this.xErrExtend = false; this.xErrRetract = false;
    this.eStep = PUSHER_STEP.IDLE;
  }
  call(a, dt) {
    const P = this.fbPusher;
    this.tonCenter.call(a.xPartAtEnd, a.tCenter, dt);
    this.xReady = this.tonCenter.Q && P.eStep === PUSHER_STEP.IDLE;
    P.call({
      xEnable: a.xEnable,
      xStart: (a.xFeed && !a.xManualMode && this.xReady && a.xPushPermit) || (a.xManualMode && a.xManPush),
      xFrontLimit: a.xFrontLimit, xBackLimit: a.xBackLimit, tTimeout: a.tTimeout, xReset: a.xReset,
    }, dt);
    this.xPushStart = P.eStep === PUSHER_STEP.EXTEND && this.eStepPrev !== PUSHER_STEP.EXTEND && !a.xManualMode;
    this.eStepPrev = P.eStep;
    if (!a.xEnable) this.xBelt = false;
    else if (a.xManualMode) this.xBelt = !!a.xManBelt;
    else this.xBelt = a.xFeed && !this.tonCenter.Q && !P.xBusy;
    this.xPush = P.xPush; this.xBusy = P.xBusy; this.xHome = P.xHome;
    this.xErrExtend = P.xErrExtend; this.xErrRetract = P.xErrRetract; this.eStep = P.eStep;
  }
}

// ---------------------------------------------------------------------
// FB_WheelSorter
// ---------------------------------------------------------------------
export class FB_WheelSorter {
  constructor() {
    this.eStep = SORTER_STEP.IDLE; this.eStepPrev = SORTER_STEP.IDLE;
    this.tonStep = new TON(); this.rtPresence = new R_TRIG(); this.ftPresence = new F_TRIG(); this.ftRead = new F_TRIG();
    this.eColor = COLOR.NONE; this.eBranch = BRANCH.NONE;
    this.xSeenOnSorter = false; this.xLeftRead = false;
    this.axNextToBases = [null, false, false];
    this.xPlus = false; this.xLeft = false; this.xRight = false; this.xHoldMain = false;
    this.xDone = false; this.xDiscarded = false; this.eDoneColor = COLOR.NONE; this.eDoneBranch = BRANCH.NONE;
    this.eNextBranch = BRANCH.NONE; this.xWaitingBranch = false;
    this.xErrUnknown = false; this.xErrTimeout = false;
    this.tonLeft = new TON(); this.tpQuiet = new TP();
  }
  call(a, dt) {
    const S = SORTER_STEP;
    this.xDone = false;
    this.xDiscarded = false;
    const xPartAtRead = a.eColorAtRead !== COLOR.NONE;
    this.rtPresence.call(a.xPresence);
    this.ftPresence.call(a.xPresence);
    this.ftRead.call(xPartAtRead);
    if (a.xResetRule) { this.axNextToBases[1] = false; this.axNextToBases[2] = false; }

    if (a.eColorAtRead === COLOR.GREEN) this.eNextBranch = this.axNextToBases[1] ? BRANCH.BASES : BRANCH.LIDS;
    else if (a.eColorAtRead === COLOR.BLUE) this.eNextBranch = this.axNextToBases[2] ? BRANCH.BASES : BRANCH.LIDS;
    else this.eNextBranch = BRANCH.NONE;

    this.tonStep.call(a.xEnable && this.eStep === this.eStepPrev && (this.eStep === S.PREPARE || this.eStep === S.TRANSFER),
      this.eStep === S.PREPARE ? a.tSettle : a.tTimeout, dt);
    this.eStepPrev = this.eStep;
    this.tonLeft.call(this.eStep === S.TRANSFER && this.xLeftRead, a.tDeliver, dt);

    if (a.xManualMode) {
      if (this.eStep !== S.ERROR) this.eStep = S.IDLE;
    } else if (a.xEnable) {
      switch (this.eStep) {
        case S.IDLE:
          if (this.rtPresence.Q && a.xAutoMode && !this.tpQuiet.Q) { this.xErrUnknown = true; this.eStep = S.ERROR; }
          else if (xPartAtRead && a.xAutoMode) {
            if ((this.eNextBranch === BRANCH.LIDS && a.xLidsFree) || (this.eNextBranch === BRANCH.BASES && a.xBasesFree)) {
              this.eColor = a.eColorAtRead; this.eBranch = this.eNextBranch;
              this.xSeenOnSorter = false; this.xLeftRead = false; this.eStep = S.PREPARE;
            }
          }
          break;
        case S.PREPARE:
          if (this.tonStep.Q) this.eStep = S.TRANSFER;
          break;
        case S.TRANSFER:
          if (this.ftRead.Q) this.xLeftRead = true;
          if (this.rtPresence.Q) this.xSeenOnSorter = true;
          if ((this.xSeenOnSorter && this.ftPresence.Q) || this.tonLeft.Q) this.eStep = S.DONE;
          else if (this.tonStep.Q) { this.xErrTimeout = true; this.eStep = S.ERROR; }
          break;
        case S.DONE:
          this.xDone = true; this.eDoneColor = this.eColor; this.eDoneBranch = this.eBranch;
          this.axNextToBases[this.eColor] = !this.axNextToBases[this.eColor];
          this.eStep = S.IDLE;
          break;
      }
    }
    // El Reset se atiende aunque la celda esté en FAULT (sin permisivo)
    if (this.eStep === S.ERROR && a.xReset) {
      this.xDiscarded = this.xErrUnknown; this.xErrUnknown = false; this.xErrTimeout = false; this.eStep = S.IDLE;
    }

    const xToLeft = a.xLidsOnLeft ? this.eBranch === BRANCH.LIDS : this.eBranch === BRANCH.BASES;
    const xMoving = a.xEnable && a.xAutoMode && (this.eStep === S.PREPARE || this.eStep === S.TRANSFER);
    if (a.xManualMode) {
      this.xPlus = a.xEnable && !!a.xManPlus;
      this.xLeft = a.xEnable && !!a.xManLeft;
      this.xRight = a.xEnable && !!a.xManRight && !a.xManLeft;
      this.xHoldMain = false;
    } else {
      this.xPlus = xMoving; this.xLeft = xMoving && xToLeft; this.xRight = xMoving && !xToLeft;
      if (this.eStep === S.PREPARE || this.eStep === S.ERROR) this.xHoldMain = true;
      else if (this.eStep === S.TRANSFER) this.xHoldMain = this.xLeftRead && xPartAtRead && (this.xSeenOnSorter || this.tonLeft.ET >= a.tEnter);
      else this.xHoldMain = xPartAtRead;
    }
    this.xWaitingBranch = a.xAutoMode && this.eStep === S.IDLE && xPartAtRead;
    this.tpQuiet.call(this.xDone, a.tDeliver, dt);
  }
}

// ---------------------------------------------------------------------
// FB_MachiningCenter
// ---------------------------------------------------------------------
export class FB_MachiningCenter {
  constructor() {
    this.ftEntry = new F_TRIG(); this.rtBusy = new R_TRIG(); this.ftBusy = new F_TRIG(); this.tonTick = new TON();
    this.tBusyStart = 0; this.run = 0; this.busy = 0;
    this.xStart = false; this.xStop = false; this.xResetOut = false; this.xLidsOut = false;
    this.xLoaded = false; this.xFinished = false; this.udiCycles = 0; this.rLastCycle_s = 0; this.rUtilization = 0;
  }
  call(a, dt, now) {
    this.xStart = a.xEnable && ((!a.xManualMode && a.xRun) || (a.xManualMode && a.xManRun));
    this.xStop = !a.xEnable;
    this.xResetOut = a.xReset;
    this.xLidsOut = a.xProduceLids;
    this.ftEntry.call(a.xEntry); this.rtBusy.call(a.xBusy); this.ftBusy.call(a.xBusy);
    this.xLoaded = this.ftEntry.Q && this.xStart;
    this.xFinished = this.ftBusy.Q;
    if (this.rtBusy.Q) this.tBusyStart = now;
    if (this.ftBusy.Q) { this.udiCycles++; this.rLastCycle_s = now - this.tBusyStart; }
    if (a.xResetCount) { this.run = 0; this.busy = 0; this.rUtilization = 0; }
    this.tonTick.call(!this.tonTick.Q, 1.0, dt);
    if (this.tonTick.Q && a.xRun && a.xEnable) {
      this.run++;
      if (a.xBusy) this.busy++;
      this.rUtilization = (100 * this.busy) / this.run;
    }
  }
}

// ---------------------------------------------------------------------
// FB_ColorDiverter
// ---------------------------------------------------------------------
export class FB_ColorDiverter {
  constructor() {
    this.tonCenter = new TON(); this.fbPusher = new FB_Pusher();
    this.xHoldBelt = false; this.xPush = false; this.xDiverted = false; this.xBusy = false; this.xHome = false;
    this.xErrExtend = false; this.xErrRetract = false; this.eStep = PUSHER_STEP.IDLE;
  }
  call(a, dt) {
    const P = this.fbPusher;
    this.tonCenter.call(a.xGreen && a.xAutoMode, a.tCenter, dt);
    P.call({
      xEnable: a.xEnable, xStart: (a.xAutoMode && this.tonCenter.Q) || (a.xManualMode && a.xManPush),
      xFrontLimit: a.xFrontLimit, xBackLimit: a.xBackLimit, tTimeout: a.tTimeout, xReset: a.xReset,
    }, dt);
    this.xHoldBelt = a.xAutoMode && (this.tonCenter.Q || (a.xHoldOnPush && P.xBusy));
    this.xDiverted = P.xDone && a.xAutoMode;
    this.xPush = P.xPush; this.xBusy = P.xBusy; this.xHome = P.xHome;
    this.xErrExtend = P.xErrExtend; this.xErrRetract = P.xErrRetract; this.eStep = P.eStep;
  }
}

// ---------------------------------------------------------------------
// FB_AlarmManager
// ---------------------------------------------------------------------
export class FB_AlarmManager {
  constructor(n) {
    this.aAlarm = ALARMS.slice(0, n).map((a) => ({ kind: a.kind, cond: false, prev: false, active: false, unack: false, count: 0 }));
    this.xAnyEmergency = false; this.xAnyFault = false; this.xAnyWarning = false; this.xAnyUnack = false;
    this.dwActiveMask = 0; this.dwUnackMask = 0;
  }
  call(xReset) {
    this.xAnyEmergency = this.xAnyFault = this.xAnyWarning = this.xAnyUnack = false;
    let act = 0, un = 0;
    this.aAlarm.forEach((a, i) => {
      if (a.cond && !a.prev) { a.active = true; a.unack = true; a.count++; }
      a.prev = a.cond;
      if (xReset) { a.unack = false; if (!a.cond) a.active = false; }
      if (a.active) {
        act |= 1 << i;
        if (a.kind === 'emergency') this.xAnyEmergency = true;
        else if (a.kind === 'fault') this.xAnyFault = true;
        else this.xAnyWarning = true;
      }
      if (a.unack) { this.xAnyUnack = true; un |= 1 << i; }
    });
    this.dwActiveMask = act >>> 0;
    this.dwUnackMask = un >>> 0;
  }
}

// ---------------------------------------------------------------------
// FB_Kpi
// ---------------------------------------------------------------------
export class FB_Kpi {
  constructor() {
    this.artExit = [new R_TRIG(), new R_TRIG(), new R_TRIG(), new R_TRIG()];
    this.tonTick = new TON();
    this.audiCount = [0, 0, 0, 0]; this.udiTotal = 0; this.rPPM = 0; this.rPPMInst = 0; this.rCycle_s = 0;
    this.rAvailability = 100; this.udiRun_s = 0; this.udiFault_s = 0;
    this.aBucket = new Array(60).fill(0); this.iBucket = 0; this.tLastExit = 0; this.xHaveLast = false;
  }
  call({ axExit, xRunning, xStopped, xResetCount }, dt, now) {
    if (xResetCount) {
      this.audiCount = [0, 0, 0, 0]; this.aBucket.fill(0); this.udiRun_s = 0; this.udiFault_s = 0;
      this.xHaveLast = false; this.rPPMInst = 0; this.rCycle_s = 0;
    }
    let xExit = false;
    this.udiTotal = 0;
    for (let i = 0; i < 4; i++) {
      if (this.artExit[i].call(axExit[i])) { this.audiCount[i]++; xExit = true; }
      this.udiTotal += this.audiCount[i];
    }
    if (xExit) {
      this.aBucket[this.iBucket]++;
      if (this.xHaveLast) { this.rCycle_s = now - this.tLastExit; if (this.rCycle_s > 0) this.rPPMInst = 60 / this.rCycle_s; }
      this.tLastExit = now; this.xHaveLast = true;
    }
    this.tonTick.call(!this.tonTick.Q, 1.0, dt);
    if (this.tonTick.Q) {
      if (xRunning) this.udiRun_s++;
      if (xStopped) this.udiFault_s++;
      this.rPPM = this.aBucket.reduce((s, v) => s + v, 0);
      this.iBucket = (this.iBucket + 1) % 60;
      this.aBucket[this.iBucket] = 0;
      if (this.udiRun_s + this.udiFault_s > 0) this.rAvailability = (100 * this.udiRun_s) / (this.udiRun_s + this.udiFault_s);
    }
    if (!xRunning) this.rPPMInst = 0;
  }
}

// ---------------------------------------------------------------------
// GVL_HMI: comandos y mandos manuales
// ---------------------------------------------------------------------
export const PULSE_CMDS = ['cmdStart', 'cmdStop', 'cmdReset', 'cmdModeAuto', 'cmdModeManual',
  'cmdClearTracking', 'cmdResetCounters', 'cmdApplyLot', 'manPushY01', 'manPushY02', 'manPushY03', 'manPushY04'];
export const HOLD_CMDS = ['cmdEStop', 'manE1', 'manE2', 'manM1', 'manM2', 'manM3', 'manM4', 'manM5', 'manM6',
  'manM7', 'manM8', 'manM9', 'manWSPlus', 'manWSLeft', 'manWSRight', 'manMC1', 'manMC2'];
const MAN_HOLD = HOLD_CMDS.filter((k) => k.startsWith('man'));

export function newHmi() {
  const h = { setLotGreen: 0, setLotBlue: 0 };
  for (const k of [...PULSE_CMDS, ...HOLD_CMDS]) h[k] = false;
  return h;
}

// =====================================================================
// PLC_PRG
// =====================================================================
export class Controller {
  constructor(param = {}) {
    this.P = { ...DEFAULT_PARAM, ...param };
    this.hmi = newHmi();
    this.eState = STATE.IDLE; this.xFirstScan = true; this.xModeAuto = true;
    this.rtBtnStart = new R_TRIG(); this.rtBtnStop = new R_TRIG(); this.rtBtnReset = new R_TRIG(); this.rtSelAuto = new R_TRIG();
    this.xSelAutoPrev = false; this.xSelPendAuto = false; this.xSelPendMan = false; this.tpReset = new TP();
    this.xLotCompleted = false; this.audiLotFed = [null, 0, 0]; this.audiFed = [null, 0, 0];
    this.afbFeed = [null, new FB_FeederStation(), new FB_FeederStation()];
    this.axAwaitDrop = [null, false, false]; this.atonAwait = [null, new TON(), new TON()]; this.atonDoor = [null, new TON(), new TON()];
    this.iTurn = 1; this.xGapReq = false; this.tonGap = new TON(); this.rtS5 = new R_TRIG();
    this.iOnMain = 0; this.fbM3 = new FB_Conveyor(); this.fbSorter = new FB_WheelSorter(); this.tonSorterWait = new TON();
    this.aBranch = [null, new Fifo(this.P.FIFO_SIZE), new Fifo(this.P.FIFO_SIZE)];
    this.aeMcColor = [null, COLOR.NONE, COLOR.NONE];
    this.aiOnOut = [null, 0, 0]; this.aiOnGreen = [null, 0, 0];
    this.afbBranch = [null, new FB_Conveyor(), new FB_Conveyor()];
    this.afbMC = [null, new FB_MachiningCenter(), new FB_MachiningCenter()];
    this.afbDiv = [null, new FB_ColorDiverter(), new FB_ColorDiverter()];
    this.afbOut = [null, new FB_Conveyor(), new FB_Conveyor()];
    this.afbGreen = [null, new FB_Conveyor(), new FB_Conveyor()];
    this.artExitBlue = [null, new R_TRIG(), new R_TRIG()]; this.artExitGreen = [null, new R_TRIG(), new R_TRIG()];
    this.atonJamBlue = [null, new TON(), new TON()]; this.atonJamGreen = [null, new TON(), new TON()];
    this.xEvtStartBlocked = false; this.xEvtQueueFull = false; this.xEvtMainLost = false; this.tonMainLost = new TON(); this.atonBranchLost = [null, new TON(), new TON()]; this.axBayWait = [null, false, false]; this.aftEntry = [null, new F_TRIG(), new F_TRIG()]; this.artMcBusy = [null, new R_TRIG(), new R_TRIG()]; this.atonBayWait = [null, new TON(), new TON()]; this.axBranchLost = [null, false, false];
    this.fbAlarm = new FB_AlarmManager(this.P.ALARM_COUNT); this.fbKpi = new FB_Kpi();
    this.tonDrain = new TON(); this.tonBlink = new TON(); this.xBlink = false;
    this.heartbeat = 0; this.lastColor = COLOR.NONE;
    this.O = {};
  }

  // Un ciclo del programa. I = imagen de entradas (GVL_IO), devuelve la imagen de salidas.
  scan(I, dt, now) {
    const P = this.P, H = this.hmi, S = STATE;

    // 0. Inicialización
    if (this.xFirstScan) { this.xFirstScan = false; this.xModeAuto = I.selAuto; this.xSelAutoPrev = I.selAuto; }

    // 1. Entradas y comandos
    const xEStopActive = (I.btnEStop !== P.ESTOP_IS_NC) || H.cmdEStop;
    const xStopPressed = I.btnStop !== P.STOP_IS_NC;
    this.rtBtnStart.call(I.btnStart); this.rtBtnStop.call(xStopPressed);
    this.rtBtnReset.call(I.btnReset); this.rtSelAuto.call(I.selAuto);
    const xStartReq = this.rtBtnStart.Q || H.cmdStart;
    const xStopReq = this.rtBtnStop.Q || H.cmdStop;
    const xResetReq = this.rtBtnReset.Q || H.cmdReset;
    // El giro del selector queda pendiente hasta que la celda esté detenida (IDLE o MANUAL)
    if (this.rtSelAuto.Q) { this.xSelPendAuto = true; this.xSelPendMan = false; }
    else if (this.xSelAutoPrev && !I.selAuto) { this.xSelPendMan = true; this.xSelPendAuto = false; }
    const xModeAutoReq = this.xSelPendAuto || H.cmdModeAuto;
    const xModeManualReq = this.xSelPendMan || H.cmdModeManual;
    this.xSelAutoPrev = I.selAuto;
    let xClearTracking = H.cmdClearTracking;
    const xResetCounters = H.cmdResetCounters;
    H.cmdStart = H.cmdStop = H.cmdReset = H.cmdModeAuto = H.cmdModeManual = H.cmdClearTracking = H.cmdResetCounters = false;
    const reset = this.tpReset.call(xResetReq, 0.2, dt);

    const axPartAtEnd = [null, I.sFeed1Ready, I.sFeed2Ready];
    const axFeedFront = [null, I.y01Front, I.y02Front], axFeedBack = [null, I.y01Back, I.y02Back];
    let axManFeedBelt = [null, H.manM1, H.manM2], axManFeedPush = [null, H.manPushY01, H.manPushY02], axManEmit = [null, H.manE1, H.manE2];
    const axEntry = [null, I.sLidsEntry, I.sBasesEntry];
    const axMcBusy = [null, I.mc1Busy, I.mc2Busy], axMcError = [null, I.mc1Error, I.mc2Error], axMcOpened = [null, I.mc1Opened, I.mc2Opened];
    const aiMcProgress = [null, I.mc1Progress, I.mc2Progress];
    const axGreenVision = [null, I.sGreenLid, I.sGreenBase];
    const axDivFront = [null, I.y03Front, I.y04Front], axDivBack = [null, I.y03Back, I.y04Back];
    const axExitBlue = [null, I.sBlueLids, I.sBlueBases], axExitGreen = [null, I.sGreenLids, I.sGreenBases];
    let axManBranch = [null, H.manM4, H.manM5], axManMC = [null, H.manMC1, H.manMC2], axManDivPush = [null, H.manPushY03, H.manPushY04];
    let axManOut = [null, H.manM6, H.manM8], axManGreen = [null, H.manM7, H.manM9];

    // 2. Modo y lote
    if (this.eState === S.IDLE || this.eState === S.MANUAL) {
      if (xModeAutoReq) this.xModeAuto = true; else if (xModeManualReq) this.xModeAuto = false; this.xSelPendAuto = false; this.xSelPendMan = false;
      if (H.cmdApplyLot) {
        P.uiLotGreen = H.setLotGreen | 0; P.uiLotBlue = H.setLotBlue | 0;
        this.audiLotFed[1] = 0; this.audiLotFed[2] = 0; this.xLotCompleted = false;
      }
    }
    H.cmdApplyLot = false;
    const xLotMode = P.uiLotGreen > 0 || P.uiLotBlue > 0;
    const axAllow = [null, !xLotMode || this.audiLotFed[1] < P.uiLotGreen, !xLotMode || this.audiLotFed[2] < P.uiLotBlue];
    const xLotDone = xLotMode && !axAllow[1] && !axAllow[2];

    // 3. Alarmas
    const A = this.fbAlarm.aAlarm; // índice 0 = alarma 1
    const setA = (id, v) => { A[id - 1].cond = !!v; };
    setA(1, xEStopActive);
    for (let k = 1; k <= 2; k++) {
      setA(2 * k, this.afbFeed[k].xErrExtend); setA(2 * k + 1, this.afbFeed[k].xErrRetract);
      setA(4 + 2 * k, this.afbDiv[k].xErrExtend); setA(5 + 2 * k, this.afbDiv[k].xErrRetract);
      // Puerta: solo es falla si se abre con el mecanizado en curso (avance 1..99 %) más de 1 s
      this.atonDoor[k].call(axMcOpened[k] && aiMcProgress[k] > 0 && aiMcProgress[k] < 100, 1, dt);
      setA(12 + k, axMcError[k]); setA(14 + k, this.atonDoor[k].Q);
      setA(15 + 2 * k, this.atonJamBlue[k].Q); setA(16 + 2 * k, this.atonJamGreen[k].Q);
    }
    setA(10, this.atonAwait[1].Q || this.atonAwait[2].Q);
    setA(11, this.fbSorter.xErrUnknown); setA(12, this.fbSorter.xErrTimeout);
    setA(21, this.xEvtStartBlocked); setA(22, this.tonSorterWait.Q); setA(23, this.xEvtQueueFull); setA(25, this.xEvtMainLost);
    setA(24, !I.fioRunning);
    this.fbAlarm.call(reset);
    this.xEvtMainLost = false; this.xEvtStartBlocked = false; this.xEvtQueueFull = false;

    // 4. Máquina de estados
    if (xEStopActive) this.eState = S.EMERGENCY;
    else if (this.fbAlarm.xAnyFault && this.eState !== S.EMERGENCY) this.eState = S.FAULT;

    let xAllHome = this.fbSorter.eStep !== SORTER_STEP.ERROR;
    let xDrained = this.iOnMain === 0 && this.fbSorter.eStep === SORTER_STEP.IDLE;
    for (let k = 1; k <= 2; k++) {
      xAllHome = xAllHome && this.afbFeed[k].xHome && this.afbDiv[k].xHome;
      xDrained = xDrained && this.aBranch[k].iCount === 0 && this.aeMcColor[k] === COLOR.NONE && !axMcBusy[k]
        && this.aiOnOut[k] === 0 && this.aiOnGreen[k] === 0 && !this.afbFeed[k].xBusy && !this.axAwaitDrop[k];
    }
    switch (this.eState) {
      case S.IDLE:
        if (!this.xModeAuto) this.eState = S.MANUAL;
        else if (xStartReq && !xStopPressed) {
          if (xAllHome) {
            if (this.xLotCompleted) { this.audiLotFed[1] = 0; this.audiLotFed[2] = 0; this.xLotCompleted = false; }
            this.eState = S.AUTO_RUN;
          } else this.xEvtStartBlocked = true;
        }
        break;
      case S.AUTO_RUN:
        if (xStopReq) this.eState = S.AUTO_STOP;
        else if (xLotDone) { this.xLotCompleted = true; this.eState = S.AUTO_STOP; }
        break;
      case S.AUTO_STOP:
        if (xStartReq && !xStopPressed && !xLotDone) this.eState = S.AUTO_RUN;
        else if (xDrained || this.tonDrain.Q) this.eState = S.IDLE;
        break;
      case S.MANUAL:
        if (this.xModeAuto) { this.eState = S.IDLE; xClearTracking = true; }
        break;
      case S.FAULT:
        if (!this.fbAlarm.xAnyFault && !this.fbAlarm.xAnyEmergency) this.eState = S.IDLE;
        break;
      case S.EMERGENCY:
        if (!xEStopActive && !this.fbAlarm.xAnyEmergency) this.eState = S.IDLE;
        break;
    }
    this.tonDrain.call(this.eState === S.AUTO_STOP, P.tDrainTimeout, dt);

    // 5. Permisivos
    const xEnable = this.eState !== S.FAULT && this.eState !== S.EMERGENCY;
    const xAutoRun = this.eState === S.AUTO_RUN;
    const xAutoActive = xAutoRun || this.eState === S.AUTO_STOP;
    const xManualMode = this.eState === S.MANUAL;
    if (!xManualMode) {
      for (const k of MAN_HOLD) H[k] = false;
      axManFeedBelt = [null, false, false]; axManFeedPush = [null, false, false]; axManEmit = [null, false, false];
      axManBranch = [null, false, false]; axManMC = [null, false, false]; axManDivPush = [null, false, false];
      axManOut = [null, false, false]; axManGreen = [null, false, false];
    }
    if (xClearTracking && !xAutoActive) {
      this.iOnMain = 0; this.xGapReq = false;
      for (let k = 1; k <= 2; k++) {
        this.aBranch[k].clear(); this.aeMcColor[k] = COLOR.NONE; this.aiOnOut[k] = 0; this.aiOnGreen[k] = 0; this.axAwaitDrop[k] = false;
      }
    }

    // 6. Zona 1: alimentación y unión
    if (this.rtS5.call(I.sMainDrop) && xAutoActive) {
      this.iOnMain++; this.xGapReq = true;
      for (let k = 1; k <= 2; k++) {
        if (this.axAwaitDrop[k]) { this.axAwaitDrop[k] = false; this.audiFed[k]++; break; }
      }
    }
    if (this.tonGap.call(this.xGapReq && this.fbM3.xMotor, P.tMergeGap, dt)) this.xGapReq = false;

    // Contención: con una rama llena no se empuja ni se emite hasta que el robot libere la bahía
    let iWip = this.iOnMain + this.aBranch[1].iCount + this.aBranch[2].iCount;
    for (let k = 1; k <= 2; k++) iWip += (this.aeMcColor[k] !== COLOR.NONE ? 1 : 0) + (this.axAwaitDrop[k] ? 1 : 0);
    // Límite de trabajo en proceso: un crudo nuevo entra cuando una máquina termina otro
    const xBaysFull = this.aBranch[1].iCount >= P.iBranchCapacity || this.aBranch[2].iCount >= P.iBranchCapacity || iWip >= P.iWipMax;
    let xMergeFree = xAutoRun && !I.sMainDrop && !this.xGapReq && !xBaysFull && this.iOnMain < P.iMainCapacity;
    for (let k = 1; k <= 2; k++) xMergeFree = xMergeFree && !this.afbFeed[k].xBusy && !this.axAwaitDrop[k];
    const axEmit = [null, false, false];
    for (let k = 1; k <= 2; k++) {
      const j = 3 - k;
      const permit = xMergeFree && axAllow[k] && (this.iTurn === k || !this.afbFeed[j].xReady || !axAllow[j]);
      const F = this.afbFeed[k];
      F.call({
        xEnable, xFeed: xAutoRun, xManualMode, xManBelt: axManFeedBelt[k], xManPush: axManFeedPush[k],
        xPartAtEnd: axPartAtEnd[k], xPushPermit: permit, xFrontLimit: axFeedFront[k], xBackLimit: axFeedBack[k],
        tCenter: P.tFeederCenter, tTimeout: P.tPusherTimeout, xReset: reset,
      }, dt);
      if (F.xPushStart) { xMergeFree = false; this.iTurn = j; this.axAwaitDrop[k] = true; this.audiLotFed[k]++; }
      if (reset) this.axAwaitDrop[k] = false;
      this.atonAwait[k].call(this.axAwaitDrop[k] && xEnable && this.fbM3.xMotor, P.tTransferTimeout, dt);
      axEmit[k] = xEnable && ((xAutoRun && axAllow[k] && !xBaysFull && F.xBelt) || (xManualMode && axManEmit[k]));
    }
    H.manPushY01 = false; H.manPushY02 = false;

    // 7. Zona 2: faja principal, identificación y wheel sorter
    const eColorRead = colorFromSensors(I.sGreenRaw, I.sBlueRaw);
    const W = this.fbSorter;
    W.call({
      xEnable, xAutoMode: xAutoActive, xManualMode, xManPlus: H.manWSPlus, xManLeft: H.manWSLeft, xManRight: H.manWSRight,
      eColorAtRead: eColorRead, xPresence: I.sSorter,
      xLidsFree: this.aBranch[1].iCount < P.iBranchCapacity, xBasesFree: this.aBranch[2].iCount < P.iBranchCapacity,
      xLidsOnLeft: P.xLidsOnLeft, tSettle: P.tSorterSettle, tTimeout: P.tSorterTimeout, tEnter: P.tSorterEnter, tDeliver: P.tSorterDeliver, xReset: reset,
      xResetRule: xClearTracking && !xAutoActive,
    }, dt);
    if (W.xDone) {
      this.iOnMain = Math.max(this.iOnMain - 1, 0);
      if (!this.aBranch[W.eDoneBranch].push(W.eDoneColor)) this.xEvtQueueFull = true;
      this.lastColor = W.eDoneColor;
    }
    if (W.xDiscarded) this.iOnMain = Math.max(this.iOnMain - 1, 0);
    this.tonSorterWait.call(W.xWaitingBranch, P.tSorterWait, dt);
    this.fbM3.call({
      xEnable, xManualMode, xAutoMode: xAutoActive, xDemand: this.iOnMain > 0 || eColorRead !== COLOR.NONE || this.axAwaitDrop[1] || this.axAwaitDrop[2],
      xHold: W.xHoldMain, xManualRun: H.manM3, tRunOn: P.tRunOn,
    }, dt);
    // Piezas perdidas en M3: se corrige la cuenta y se avisa (alarma 25)
    this.tonMainLost.call(xAutoActive && this.fbM3.xMotor && this.iOnMain > 0 && eColorRead === COLOR.NONE
      && W.eStep === SORTER_STEP.IDLE && !I.sSorter, P.tMainLost, dt);
    if (this.tonMainLost.Q) { this.iOnMain = 0; this.xEvtMainLost = true; }

    // 8. Zonas 3 y 4
    for (let k = 1; k <= 2; k++) {
      // Una sola pieza en la bahía: tras pasar S8/S9 la faja espera a que el robot la tome
      this.aftEntry[k].call(axEntry[k]); this.artMcBusy[k].call(axMcBusy[k]);
      if (this.aftEntry[k].Q && xAutoActive) this.axBayWait[k] = true;
      this.atonBayWait[k].call(this.axBayWait[k], P.tBayWait, dt);
      if (this.artMcBusy[k].Q || this.atonBayWait[k].Q || !xAutoActive) this.axBayWait[k] = false;
      this.afbBranch[k].call({
        xEnable, xManualMode, xAutoMode: xAutoActive, xDemand: this.aBranch[k].iCount > 0, xHold: axEntry[k] || this.axBayWait[k],
        xManualRun: axManBranch[k], tRunOn: P.tRunOn,
      }, dt);
      // Piezas perdidas o atascadas en la rama: aviso (alarma 25); la cola se vacía con Reset
      this.atonBranchLost[k].call(xAutoActive && this.afbBranch[k].xMotor && this.aBranch[k].iCount > 0 && !axEntry[k], P.tMainLost, dt);
      if (this.atonBranchLost[k].Q) { this.axBranchLost[k] = true; this.xEvtMainLost = true; }
      if (this.axBranchLost[k] && reset) { this.aBranch[k].clear(); this.axBranchLost[k] = false; }
      const M = this.afbMC[k];
      M.call({
        xEnable, xRun: xAutoActive, xManualMode, xManRun: axManMC[k], xProduceLids: k === 1,
        xBusy: axMcBusy[k], xEntry: axEntry[k], xReset: reset, xResetCount: xResetCounters,
      }, dt, now);
      if (M.xLoaded && xAutoActive) this.aeMcColor[k] = this.aBranch[k].pop();
      if (M.xFinished && xAutoActive) { this.aiOnOut[k]++; this.aeMcColor[k] = COLOR.NONE; }

      const D = this.afbDiv[k];
      D.call({
        xEnable, xAutoMode: xAutoActive, xManualMode, xManPush: axManDivPush[k], xGreen: axGreenVision[k],
        xFrontLimit: axDivFront[k], xBackLimit: axDivBack[k], tCenter: P.tDiverterCenter, tTimeout: P.tPusherTimeout,
        xHoldOnPush: P.xHoldOutOnPush, xReset: reset,
      }, dt);
      if (D.xDiverted) { this.aiOnOut[k] = Math.max(this.aiOnOut[k] - 1, 0); this.aiOnGreen[k]++; }

      this.afbOut[k].call({
        xEnable, xManualMode, xAutoMode: xAutoActive, xDemand: this.aiOnOut[k] > 0 || this.aeMcColor[k] !== COLOR.NONE, xHold: D.xHoldBelt,
        xManualRun: axManOut[k], tRunOn: P.tRunOn,
      }, dt);
      this.afbGreen[k].call({
        xEnable, xManualMode, xAutoMode: xAutoActive, xDemand: this.aiOnGreen[k] > 0, xHold: false,
        xManualRun: axManGreen[k], tRunOn: P.tRunOn,
      }, dt);

      if (this.artExitBlue[k].call(axExitBlue[k]) && xAutoActive) this.aiOnOut[k] = Math.max(this.aiOnOut[k] - 1, 0);
      if (this.artExitGreen[k].call(axExitGreen[k]) && xAutoActive) this.aiOnGreen[k] = Math.max(this.aiOnGreen[k] - 1, 0);
      this.atonJamBlue[k].call(axExitBlue[k] && this.afbOut[k].xMotor, P.tJam, dt);
      this.atonJamGreen[k].call(axExitGreen[k] && this.afbGreen[k].xMotor, P.tJam, dt);
    }
    H.manPushY03 = false; H.manPushY04 = false;

    // 9. Salidas y señalización
    if (this.tonBlink.call(!this.tonBlink.Q, 0.5, dt)) this.xBlink = !this.xBlink;
    const st = this.eState, al = this.fbAlarm;
    const O = {
      e1: axEmit[1], e2: axEmit[2],
      m1: this.afbFeed[1].xBelt, m2: this.afbFeed[2].xBelt, y01: this.afbFeed[1].xPush, y02: this.afbFeed[2].xPush,
      m3: this.fbM3.xMotor, wsPlus: W.xPlus, wsLeft: W.xLeft, wsRight: W.xRight,
      m4: this.afbBranch[1].xMotor, m5: this.afbBranch[2].xMotor,
      mc1Start: this.afbMC[1].xStart, mc1Stop: this.afbMC[1].xStop, mc1Reset: this.afbMC[1].xResetOut, mc1Lids: this.afbMC[1].xLidsOut,
      mc2Start: this.afbMC[2].xStart, mc2Stop: this.afbMC[2].xStop, mc2Reset: this.afbMC[2].xResetOut, mc2Lids: this.afbMC[2].xLidsOut,
      m6: this.afbOut[1].xMotor, y03: this.afbDiv[1].xPush, m7: this.afbGreen[1].xMotor,
      m8: this.afbOut[2].xMotor, y04: this.afbDiv[2].xPush, m9: this.afbGreen[2].xMotor,
      lampGreen: st === S.AUTO_RUN || (st === S.AUTO_STOP && this.xBlink),
      lampYellow: st === S.IDLE || (st === S.MANUAL && this.xBlink) || (al.xAnyWarning && this.xBlink),
      lampRed: st === S.EMERGENCY || (st === S.FAULT && this.xBlink),
      lampStart: st === S.IDLE && this.xModeAuto,
      lampReset: al.xAnyUnack && this.xBlink,
      lampStop: st !== S.AUTO_RUN,
      display: 0,
    };

    // 10. KPI
    this.fbKpi.call({
      axExit: [I.sBlueLids, I.sGreenLids, I.sBlueBases, I.sGreenBases],
      xRunning: st === S.AUTO_RUN, xStopped: st === S.FAULT || st === S.EMERGENCY, xResetCount: xResetCounters,
    }, dt, now);
    if (xResetCounters) { this.audiFed[1] = 0; this.audiFed[2] = 0; }
    O.display = this.fbKpi.udiTotal % 10000;
    this.xLotMode = xLotMode;
    this.heartbeat++;
    this.O = O;
    return O;
  }

  // Equivalente a lo que el PLC publica en GVL_HMI
  status() {
    const K = this.fbKpi, W = this.fbSorter;
    return {
      state: this.eState, modeAuto: this.xModeAuto, turnBlue: this.iTurn === 2,
      sorterStep: W.eStep, sorterNext: W.eNextBranch, lastColor: this.lastColor,
      nextGreenToBases: W.axNextToBases[1], nextBlueToBases: W.axNextToBases[2],
      onMain: this.iOnMain, lidsQueue: this.aBranch[1].iCount, basesQueue: this.aBranch[2].iCount,
      lidsQueueWord: this.aBranch[1].pack(), basesQueueWord: this.aBranch[2].pack(),
      mc1Color: this.aeMcColor[1], mc2Color: this.aeMcColor[2],
      onLidsOut: this.aiOnOut[1], onGreenLids: this.aiOnGreen[1], onBasesOut: this.aiOnOut[2], onGreenBases: this.aiOnGreen[2],
      pusherStep: { y01: this.afbFeed[1].eStep, y02: this.afbFeed[2].eStep, y03: this.afbDiv[1].eStep, y04: this.afbDiv[2].eStep },
      lot: {
        mode: !!this.xLotMode, completed: this.xLotCompleted, green: this.P.uiLotGreen, blue: this.P.uiLotBlue,
        fedGreen: this.audiLotFed[1], fedBlue: this.audiLotFed[2],
      },
      alarms: { active: this.fbAlarm.dwActiveMask, unack: this.fbAlarm.dwUnackMask },
      heartbeat: this.heartbeat,
      kpi: {
        total: K.udiTotal, blueLids: K.audiCount[0], greenLids: K.audiCount[1], blueBases: K.audiCount[2], greenBases: K.audiCount[3],
        fedGreen: this.audiFed[1], fedBlue: this.audiFed[2],
        ppm: K.rPPM, ppmInst: K.rPPMInst, cycle: K.rCycle_s, availability: K.rAvailability,
        utilMC1: this.afbMC[1].rUtilization, utilMC2: this.afbMC[2].rUtilization,
        cycleMC1: this.afbMC[1].rLastCycle_s, cycleMC2: this.afbMC[2].rLastCycle_s,
        runTime: K.udiRun_s, faultTime: K.udiFault_s,
      },
    };
  }
}

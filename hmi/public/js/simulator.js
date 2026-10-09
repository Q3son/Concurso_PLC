// =====================================================================
// FactorySim: gemelo digital = planta (plant.js) + controlador espejo del PLC (control.js).
// Sirve para: demo web sin PLC, pruebas automáticas (npm test) y PLC simulado por OPC UA.
// Ciclo: entradas de la planta -> scan del PLC -> salidas -> la planta avanza dt.
// =====================================================================
import { Controller, PULSE_CMDS, HOLD_CMDS } from './control.js';
import { Plant, FAULTS } from './plant.js';

// Nombres de comando del tablero -> variable de GVL_HMI (sin prefijo)
export const CMD_TO_HMI = Object.freeze({
  start: 'cmdStart', stop: 'cmdStop', reset: 'cmdReset', modeAuto: 'cmdModeAuto', modeManual: 'cmdModeManual',
  clearTracking: 'cmdClearTracking', resetCounters: 'cmdResetCounters', applyLot: 'cmdApplyLot', estop: 'cmdEStop',
  manPushY01: 'manPushY01', manPushY02: 'manPushY02', manPushY03: 'manPushY03', manPushY04: 'manPushY04',
  manE1: 'manE1', manE2: 'manE2', manM1: 'manM1', manM2: 'manM2', manM3: 'manM3', manM4: 'manM4', manM5: 'manM5',
  manM6: 'manM6', manM7: 'manM7', manM8: 'manM8', manM9: 'manM9',
  manWSPlus: 'manWSPlus', manWSLeft: 'manWSLeft', manWSRight: 'manWSRight', manMC1: 'manMC1', manMC2: 'manMC2',
});
export const SIM_ONLY = Object.freeze([...FAULTS, 'removeSorterPart', 'removeMc1Part', 'removeMc2Part']);

export class FactorySim {
  constructor({ seed = 2026, param = {}, emitMin, emitMax, scanTime = 0.01 } = {}) {
    this.plant = new Plant({ seed, emitMin, emitMax });
    this.plc = new Controller(param);
    this.scanTime = scanTime;          // el PLC real escanea cada 10 ms
    this.t = 0;
    this.outputs = {};
    this.inputs = this.plant.inputs;
  }

  // Comandos del tablero (mismo nombre que COMMANDS en src/tags.js)
  command(name, value = true) {
    const H = this.plc.hmi;
    if (name === 'setLot') {
      H.setLotGreen = Math.max(0, Math.min(65535, value?.green | 0));
      H.setLotBlue = Math.max(0, Math.min(65535, value?.blue | 0));
      H.cmdApplyLot = true;
      return;
    }
    if (name in CMD_TO_HMI) {
      const key = CMD_TO_HMI[name];
      H[key] = PULSE_CMDS.includes(key) ? true : !!value;
      return;
    }
    if (name === 'removeSorterPart') return this.plant.clearZone('sorter');
    if (name === 'removeMc1Part') return this.plant.clearZone('mc1');
    if (name === 'removeMc2Part') return this.plant.clearZone('mc2');
    if (name in this.plant.faults) this.plant.faults[name] = !!value;
  }

  get param() { return this.plc.P; }

  step(dt) {
    // Subdivide en ciclos de PLC para que la lógica vea los mismos flancos que en CODESYS
    let rest = dt;
    while (rest > 1e-9) {
      const h = Math.min(this.scanTime, rest);
      this.t += h;
      this.outputs = this.plc.scan(this.plant.inputs, h, this.t);
      this.inputs = this.plant.step(this.outputs, h);
      rest -= h;
    }
  }

  run(seconds, dt = 0.05) {
    const n = Math.round(seconds / dt);
    for (let i = 0; i < n; i++) this.step(dt);
  }

  snapshot() {
    const st = this.plc.status();
    const H = this.plc.hmi;
    const hmi = {};
    for (const k of HOLD_CMDS) hmi[k.replace(/^cmd/, '').replace(/^EStop$/, 'estop')] = H[k];
    const mc = this.plant.mc;
    return {
      source: 'sim', connected: true, ts: Date.now(),
      ...st,
      inputs: { ...this.inputs },
      outputs: { ...this.outputs },
      hmi: { ...hmi, estop: H.cmdEStop },
      parts: this.plant.snapshotParts(),
      pushers: { ...this.plant.pusherPos },
      machines: {
        MC1: { state: mc.MC1.state, progress: mc.MC1.progress, color: mc.MC1.part?.color ?? null, kind: mc.MC1.part?.kind ?? null },
        MC2: { state: mc.MC2.state, progress: mc.MC2.progress, color: mc.MC2.part?.color ?? null, kind: mc.MC2.part?.kind ?? null },
      },
      faults: { ...this.plant.faults },
      simTime: this.t,
    };
  }
}

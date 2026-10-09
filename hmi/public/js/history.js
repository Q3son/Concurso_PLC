// Historial de alarmas y de producción (se usa en el servidor y en la demo del navegador).
import { ALARMS } from './constants.js';

export class History {
  constructor({ maxEvents = 200, maxPoints = 120 } = {}) {
    this.maxEvents = maxEvents;
    this.maxPoints = maxPoints;
    this.events = [];      // { ts, id, on }
    this.ppm = [];         // { ts, v }
    this.lastMask = 0;
    this.lastSample = 0;
  }

  update(snap, now = Date.now()) {
    const mask = snap.alarms.active >>> 0;
    const changed = (mask ^ this.lastMask) >>> 0;
    if (changed) {
      for (const a of ALARMS) {
        const bit = 1 << (a.id - 1);
        if (changed & bit) this.events.unshift({ ts: now, id: a.id, on: (mask & bit) !== 0 });
      }
      this.events.length = Math.min(this.events.length, this.maxEvents);
      this.lastMask = mask;
    }
    if (now - this.lastSample >= 1000) {
      this.ppm.push({ ts: now, v: snap.kpi.ppm });
      if (this.ppm.length > this.maxPoints) this.ppm.shift();
      this.lastSample = now;
    }
  }

  toJSON() {
    return { events: this.events, ppm: this.ppm };
  }
}

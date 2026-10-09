// =====================================================================
// Servidor del tablero de control (HMI/SCADA web)
//   npm run demo  -> planta simulada (sin PLC)
//   npm start     -> PLC real: CODESYS por OPC UA
// =====================================================================
import 'dotenv/config';
import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { WebSocketServer } from 'ws';
import { FactorySim, SIM_ONLY } from './public/js/simulator.js';
import { History } from './public/js/history.js';
import { PlcClient } from './src/opcua-client.js';
import { COMMANDS } from './src/tags.js';
import { startArduinoBridge } from './src/arduino-bridge.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SIM = process.argv.includes('--sim') || process.env.MODE === 'sim';
const PORT = Number(process.env.PORT) || 3000;
const POLL_MS = Number(process.env.POLL_MS) || 200;

const log = {
  info: (...a) => console.log(new Date().toLocaleTimeString(), ...a),
  warn: (...a) => console.warn(new Date().toLocaleTimeString(), ...a),
  error: (...a) => console.error(new Date().toLocaleTimeString(), ...a),
};

// ---------------------------------------------------------------------
// Fuente de datos: simulador o PLC
// ---------------------------------------------------------------------
const history = new History();
let latest = { source: SIM ? 'sim' : 'plc', connected: false };
const estop = { hmi: false, arduino: false };

let sim = null;
let plc = null;
let lastHeartbeat = null;
let lastHeartbeatChange = Date.now();

if (SIM) {
  sim = new FactorySim({ seed: Date.now() & 0xffff });
  setInterval(() => sim.step(0.05), 50);
  setTimeout(() => sim.command('start'), 1500);
  log.info('Modo DEMO: planta simulada (sin PLC)');
} else {
  plc = new PlcClient({
    endpoint: process.env.OPCUA_ENDPOINT || 'opc.tcp://localhost:4840',
    user: process.env.OPCUA_USER || undefined,
    password: process.env.OPCUA_PASSWORD || undefined,
    device: process.env.OPCUA_DEVICE || undefined,
    application: process.env.OPCUA_APPLICATION || 'Application',
    log,
  });
}

let busy = false;
let retryAt = 0;
async function poll() {
  if (busy) return;
  busy = true;
  try {
    if (SIM) {
      latest = sim.snapshot();
    } else {
      if (!plc.connected) {
        if (Date.now() < retryAt) return;
        await plc.disconnect();
        await plc.connect();
      }
      latest = await plc.readAll();
      // Vigilancia de comunicación: el heartbeat del PLC debe cambiar
      if (latest.heartbeat !== lastHeartbeat) {
        lastHeartbeat = latest.heartbeat;
        lastHeartbeatChange = Date.now();
      }
      latest.stale = Date.now() - lastHeartbeatChange > 2000;
    }
    history.update(latest);
  } catch (err) {
    if (plc?.connected) log.warn(`[OPC UA] Conexión perdida: ${err.message}`);
    else log.warn(`[OPC UA] Sin conexión: ${err.message} (reintento en 3 s)`);
    plc.connected = false;
    retryAt = Date.now() + 3000;
    latest = { source: 'plc', connected: false, error: err.message, ts: Date.now() };
  } finally {
    busy = false;
    broadcast();
  }
}
setInterval(poll, POLL_MS);

async function sendCommand(name, value) {
  if (name === 'estop') {
    estop.hmi = !!value;
    value = estop.hmi || estop.arduino;
  }
  if (SIM) {
    sim.command(name, value);
    return;
  }
  if (!plc.connected) throw new Error('PLC no conectado');
  await plc.command(name, value);
}

// ---------------------------------------------------------------------
// HTTP + WebSocket
// ---------------------------------------------------------------------
const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.get('/api/health', (_req, res) => res.json({ mode: SIM ? 'sim' : 'plc', connected: !!latest.connected }));

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

function broadcast() {
  if (wss.clients.size === 0) return;
  const msg = JSON.stringify({ type: 'snapshot', data: latest, history: history.toJSON() });
  for (const ws of wss.clients) if (ws.readyState === 1) ws.send(msg);
}

wss.on('connection', (ws, req) => {
  log.info(`HMI conectado desde ${req.socket.remoteAddress}`);
  ws.send(JSON.stringify({ type: 'hello', mode: SIM ? 'sim' : 'plc' }));
  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (msg?.type !== 'cmd' || typeof msg.name !== 'string') return;
    const allowed = msg.name in COMMANDS || (SIM && SIM_ONLY.includes(msg.name));
    if (!allowed) return;
    try {
      await sendCommand(msg.name, msg.value);
    } catch (err) {
      ws.send(JSON.stringify({ type: 'error', message: err.message }));
    }
  });
});

server.listen(PORT, () => {
  log.info(`Tablero disponible en http://localhost:${PORT}`);
});

// ---------------------------------------------------------------------
// Botonera física opcional (Arduino)
// ---------------------------------------------------------------------
if (process.env.ARDUINO_PORT) {
  startArduinoBridge({
    path: process.env.ARDUINO_PORT,
    baudRate: Number(process.env.ARDUINO_BAUD) || 115200,
    onCommand: (name) => sendCommand(name).catch((e) => log.warn(`[Arduino] ${e.message}`)),
    onEStop: (on) => {
      estop.arduino = on;
      sendCommand('estop', estop.hmi).catch((e) => log.warn(`[Arduino] ${e.message}`));
    },
    getSnapshot: () => latest,
    log,
  });
}

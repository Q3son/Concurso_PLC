// Puente opcional: botonera física con Arduino (Start / Stop / Reset / Emergencia + 3 LEDs).
// Protocolo serie (115200 baud, líneas de texto):
//   Arduino -> PC : BTN:START | BTN:STOP | BTN:RESET | ESTOP:1 | ESTOP:0 | HB
//   PC -> Arduino : L:gyr   (g, y, r = 0/1 para LED verde, amarillo, rojo)
// IMPORTANTE: es una botonera didáctica. Una parada de emergencia real debe cortar
// la energía por hardware (relé de seguridad), nunca solo por software.

export async function startArduinoBridge({ path, baudRate = 115200, onCommand, onEStop, getSnapshot, log = console }) {
  let SerialPort, ReadlineParser;
  try {
    ({ SerialPort, ReadlineParser } = await import('serialport'));
  } catch {
    log.warn('[Arduino] Paquete "serialport" no instalado. Ejecuta: npm install serialport');
    return null;
  }

  const port = new SerialPort({ path, baudRate });
  const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));
  let lastHb = 0;
  let seen = false;
  let watchdogTripped = false;

  port.on('open', () => log.info(`[Arduino] Conectado en ${path}`));
  port.on('error', (e) => log.error(`[Arduino] ${e.message}`));

  parser.on('data', (raw) => {
    const line = raw.trim();
    if (line === 'HB') {
      lastHb = Date.now();
      seen = true;
      if (watchdogTripped) { watchdogTripped = false; log.info('[Arduino] Heartbeat recuperado'); }
      return;
    }
    if (line === 'BTN:START') onCommand('start');
    else if (line === 'BTN:STOP') onCommand('stop');
    else if (line === 'BTN:RESET') onCommand('reset');
    else if (line === 'ESTOP:1') onEStop(true);
    else if (line === 'ESTOP:0') onEStop(false);
  });

  const timer = setInterval(() => {
    // Watchdog fail-safe: si la botonera deja de responder, se activa la emergencia
    if (seen && !watchdogTripped && Date.now() - lastHb > 1500) {
      watchdogTripped = true;
      log.warn('[Arduino] Sin heartbeat: se activa paro de emergencia por seguridad');
      onEStop(true);
    }
    const o = getSnapshot()?.outputs;
    if (o && port.isOpen) port.write(`L:${o.lampGreen ? 1 : 0}${o.lampYellow ? 1 : 0}${o.lampRed ? 1 : 0}\n`);
  }, 250);

  return { close: () => { clearInterval(timer); port.close(); } };
}

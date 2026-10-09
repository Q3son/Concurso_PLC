// PLC simulado con servidor OPC UA que imita la estructura de nombres de CODESYS.
// Por dentro corre el gemelo digital (planta + espejo de PLC_PRG), así que se comporta como
// la celda real. Permite probar el tablero por OPC UA sin CODESYS ni Factory I/O.
// Uso: npm run mock-plc   (y en otra terminal: npm start)
import { OPCUAServer, Variant, DataType, StatusCodes } from 'node-opcua';
import { FactorySim } from '../public/js/simulator.js';
import { READ_TAGS, COMMANDS } from './tags.js';

const DEVICE = 'CODESYS Control Win V3 x64';
const PORT = Number(process.env.MOCK_PORT) || 4840;

const sim = new FactorySim({ seed: 7 });
setInterval(() => sim.step(0.05), 50);
let snap = sim.snapshot();
setInterval(() => { snap = sim.snapshot(); }, 50);
setTimeout(() => sim.command('start'), 1500);

// Tipo OPC UA a partir del prefijo húngaro de la variable
const typeOf = (path) => {
  const name = path.split('.').pop();
  if (name.startsWith('udi') || name.startsWith('dw')) return DataType.UInt32;
  if (name.startsWith('ui') || name.startsWith('w')) return DataType.UInt16;
  if (name.startsWith('r')) return DataType.Float;
  if (name.startsWith('i')) return DataType.Int16;
  return DataType.Boolean;
};
const get = (obj, key) => key.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

const server = new OPCUAServer({ port: PORT, allowAnonymous: true, buildInfo: { productName: 'Mock CODESYS' } });
await server.initialize();
const addressSpace = server.engine.addressSpace;
const ns = addressSpace.registerNamespace('CODESYSSPV3/3S/IecVarAccess');
const deviceSet = ns.addObject({ organizedBy: addressSpace.rootFolder.objects, browseName: 'DeviceSet' });
const device = ns.addObject({ componentOf: deviceSet, browseName: DEVICE });

const byPath = new Map();
for (const [key, path] of READ_TAGS) byPath.set(path, { key });
for (const [name, def] of Object.entries(COMMANDS)) {
  if (def.lot) continue;
  byPath.set(def.path, { ...(byPath.get(def.path) || {}), command: name, pulse: !!def.pulse });
}
// Lote: dos enteros y un pulso de aplicación
const lotBuffer = { green: 0, blue: 0 };
byPath.set(COMMANDS.setLot.green, { write: (v) => { lotBuffer.green = v; }, read: () => lotBuffer.green });
byPath.set(COMMANDS.setLot.blue, { write: (v) => { lotBuffer.blue = v; }, read: () => lotBuffer.blue });
byPath.set(COMMANDS.setLot.apply, { write: (v) => { if (v) sim.command('setLot', { ...lotBuffer }); }, read: () => false });

for (const [path, info] of byPath) {
  const dataType = typeOf(path);
  ns.addVariable({
    componentOf: device,
    browseName: path,
    nodeId: `s=|var|${DEVICE}.Application.${path}`,
    dataType,
    minimumSamplingInterval: 100,
    value: {
      get: () => {
        let v = info.read ? info.read() : info.key ? get(snap, info.key) : false;
        if (dataType === DataType.Boolean) v = !!v;
        else v = Number(v) || 0;
        return new Variant({ dataType, value: v });
      },
      set: (variant) => {
        if (info.write) { info.write(variant.value); return StatusCodes.Good; }
        if (!info.command) return StatusCodes.BadNotWritable;
        if (info.pulse) { if (variant.value) sim.command(info.command); }
        else sim.command(info.command, !!variant.value);
        return StatusCodes.Good;
      },
    },
  });
}

await server.start();
console.log(`PLC simulado (OPC UA) en opc.tcp://localhost:${PORT}  dispositivo "${DEVICE}"`);
console.log(`${byPath.size} variables publicadas. En otra terminal: npm start`);

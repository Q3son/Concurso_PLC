// Cliente OPC UA para CODESYS (servidor OPC UA integrado del runtime).
import {
  OPCUAClient, AttributeIds, DataType, MessageSecurityMode, SecurityPolicy, UserTokenType,
} from 'node-opcua';
import { READ_TAGS, COMMANDS, setPath } from './tags.js';

const isGood = (sc) => !!sc && sc.value === 0;

const CODESYS_NS_URI = 'CODESYSSPV3/3S/IecVarAccess';
const DEVICE_CANDIDATES = [
  'CODESYS Control Win V3 x64',
  'CODESYS Control Win V3',
  'CODESYS Control for Linux SL',
  'CODESYS Control for Raspberry Pi SL',
];

export class PlcClient {
  constructor({ endpoint, user, password, device, application = 'Application', log = console }) {
    this.endpoint = endpoint;
    this.user = user;
    this.password = password;
    this.device = device;          // opcional: fuerza el nombre del dispositivo
    this.application = application;
    this.log = log;
    this.client = null;
    this.session = null;
    this.ns = 4;
    this.connected = false;
  }

  nodeId(path) {
    return `ns=${this.ns};s=|var|${this.device}.${this.application}.${path}`;
  }

  async connect() {
    this.client = OPCUAClient.create({
      applicationName: 'SmartFactoryHMI',
      securityMode: MessageSecurityMode.None,
      securityPolicy: SecurityPolicy.None,
      endpointMustExist: false,
      connectionStrategy: { initialDelay: 500, maxRetry: 0 },
      requestedSessionTimeout: 60000,
    });
    this.client.on('connection_lost', () => { this.connected = false; });
    await this.client.connect(this.endpoint);

    const identity = this.user
      ? { type: UserTokenType.UserName, userName: this.user, password: this.password ?? '' }
      : { type: UserTokenType.Anonymous };
    this.session = await this.client.createSession(identity);

    const nsArray = await this.session.readNamespaceArray();
    const idx = nsArray.indexOf(CODESYS_NS_URI);
    if (idx >= 0) this.ns = idx;

    if (!this.device) this.device = await this.detectDevice();
    this.connected = true;
    this.log.info(`[OPC UA] Conectado a ${this.endpoint} (ns=${this.ns}, dispositivo "${this.device}")`);
  }

  async detectDevice() {
    for (const dev of DEVICE_CANDIDATES) {
      const id = `ns=${this.ns};s=|var|${dev}.${this.application}.GVL_HMI.udiHeartbeat`;
      const dv = await this.session.read({ nodeId: id, attributeId: AttributeIds.Value });
      if (isGood(dv.statusCode)) return dev;
    }
    throw new Error('No se encontró GVL_HMI en el servidor OPC UA. ¿Configuraste la "Symbol Configuration" '
      + 'con soporte OPC UA? Ejecuta "npm run browse" para ver el nombre exacto del dispositivo.');
  }

  async readAll() {
    const nodes = READ_TAGS.map(([, path]) => ({ nodeId: this.nodeId(path), attributeId: AttributeIds.Value }));
    const values = await this.session.read(nodes);
    const snap = { source: 'plc', connected: true, ts: Date.now() };
    let bad = 0;
    values.forEach((dv, i) => {
      const [key] = READ_TAGS[i];
      if (!isGood(dv.statusCode)) { bad++; return; }
      let v = dv.value.value;
      if (typeof v === 'bigint') v = Number(v);
      setPath(snap, key, v);
    });
    if (bad === values.length) throw new Error('Todas las lecturas fallaron (¿PLC detenido?)');
    snap.badTags = bad;
    return snap;
  }

  async write(path, dataType, value) {
    const status = await this.session.write({
      nodeId: this.nodeId(path),
      attributeId: AttributeIds.Value,
      value: { value: { dataType, value } },
    });
    if (!isGood(status)) throw new Error(`Escritura rechazada (${status.name}) en ${path}`);
  }

  async command(name, value = true) {
    const def = COMMANDS[name];
    if (!def) throw new Error(`Comando desconocido: ${name}`);
    if (def.lot) {
      const clamp = (n) => Math.max(0, Math.min(65535, Number(n) | 0));
      await this.write(def.green, DataType.UInt16, clamp(value?.green));
      await this.write(def.blue, DataType.UInt16, clamp(value?.blue));
      await this.write(def.apply, DataType.Boolean, true);
      return;
    }
    await this.write(def.path, DataType.Boolean, def.pulse ? true : !!value);
  }

  async disconnect() {
    this.connected = false;
    try { await this.session?.close(); } catch { /* ignorar */ }
    try { await this.client?.disconnect(); } catch { /* ignorar */ }
    this.session = null;
    this.client = null;
  }
}
